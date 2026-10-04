from datetime import date
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from fastapi import HTTPException, status as http_status

from app.models.keuangan import Aset, HutangUsaha, KasBank
from app.models.supplier import Supplier
from app.schemas.keuangan import AssetCreate, AssetUpdate
from app.utils.constants import (
    AssetStatus,
    HutangSource,
    HutangStatus,
    KasBankSource,
    KasBankType,
    PaymentMethod,
    TRANSACTION_PREFIXES,
)

# Kolom AssetCreate yang bukan kolom tabel aset (data pembelian).
_PEMBELIAN_FIELDS = {"payments", "supplier_id", "nama_penjual"}


class AssetService:
    """Service for managing fixed assets (Aset)."""

    def __init__(self, db: Session):
        self.db = db

    def _generate_kode(self) -> str:
        """Generate unique asset code AST-YYYYMM-XXXX."""
        prefix = TRANSACTION_PREFIXES.get("aset", "AST")
        today = date.today()
        date_str = today.strftime("%Y%m")
        
        # Get last asset with the same date prefix
        last = (
            self.db.query(Aset)
            .filter(Aset.kode.like(f"{prefix}-{date_str}-%"))
            .order_by(Aset.id.desc())
            .first()
        )
        
        if last:
            try:
                last_num = int(last.kode.split("-")[-1])
                new_num = last_num + 1
            except (ValueError, IndexError):
                new_num = 1
        else:
            new_num = 1
            
        return f"{prefix}-{date_str}-{new_num:04d}"

    def create(self, obj_in: AssetCreate, user_id: int) -> Aset:
        """Daftar / beli aset tetap.

        `sumber_dana` (seperti pembelian spare part):
          KAS           -> tiap `payments` jadi Kas Keluar sumber ASET; sisa harga
                           yang belum dibayar jadi hutang ke penjual.
          HUTANG        -> seluruh harga jadi hutang ke penjual.
          SETORAN_MODAL -> aset disetor pemilik; tanpa kas/hutang (Perubahan
                           Modal menampilkannya sebagai setoran non-kas).
          None          -> hanya daftar (klien lama) — tanpa sumber dana, aset
                           muncul sebagai Penyesuaian Backdate di laporan.
        Semua baris dibuat dalam satu transaksi (all-or-nothing).
        """
        sumber_dana = obj_in.sumber_dana
        harga = Decimal(obj_in.harga_beli)
        payments = list(obj_in.payments or []) if sumber_dana == "KAS" else []
        total_bayar = sum((Decimal(p.jumlah) for p in payments), Decimal("0"))

        if sumber_dana == "KAS" and not payments:
            raise HTTPException(http_status.HTTP_400_BAD_REQUEST, "Isi minimal satu pembayaran kas/bank")
        if total_bayar > harga:
            raise HTTPException(
                http_status.HTTP_400_BAD_REQUEST,
                f"Total pembayaran (Rp{total_bayar:,.0f}) melebihi harga aset (Rp{harga:,.0f})",
            )
        for p in payments:
            if p.metode not in (PaymentMethod.TUNAI, PaymentMethod.TRANSFER):
                raise HTTPException(http_status.HTTP_400_BAD_REQUEST, "Metode pembayaran aset harus TUNAI atau TRANSFER")

        sisa_hutang = harga - total_bayar if sumber_dana in ("KAS", "HUTANG") else Decimal("0")
        kreditur = None
        if sisa_hutang > 0:
            if obj_in.supplier_id:
                supplier = self.db.get(Supplier, obj_in.supplier_id)
                if not supplier:
                    raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Supplier tidak ditemukan")
                kreditur = supplier.nama
            kreditur = kreditur or (obj_in.nama_penjual or "").strip() or None
            if not kreditur:
                raise HTTPException(
                    http_status.HTTP_400_BAD_REQUEST,
                    "Pilih supplier / isi nama penjual untuk sisa yang dicatat sebagai hutang",
                )

        db_obj = Aset(
            **obj_in.model_dump(exclude=_PEMBELIAN_FIELDS),
            kode=self._generate_kode(),
            created_by=user_id,
        )
        self.db.add(db_obj)
        self.db.flush()

        try:
            if payments:
                from app.services.kas_bank_integration import create_kas_entry
                n = len(payments)
                for i, p in enumerate(payments, start=1):
                    urutan = f" ({i}/{n})" if n > 1 else ""
                    create_kas_entry(
                        db=self.db,
                        tanggal=db_obj.tanggal_beli,
                        tipe=KasBankType.KELUAR,
                        nominal=Decimal(p.jumlah),
                        sumber=KasBankSource.ASET,
                        metode_bayar=p.metode,
                        referensi_id=db_obj.id,
                        nomor_referensi=db_obj.kode,
                        keterangan=f"Pembelian aset {db_obj.kode} - {db_obj.nama}{urutan}",
                        user_id=user_id,
                        kas_jenis=p.kas_jenis,
                        commit=False,
                    )
            if sisa_hutang > 0:
                from app.services.hutang_service import HutangService
                self.db.add(HutangUsaha(
                    nomor_hutang=HutangService(self.db)._generate_nomor_hutang(),
                    tanggal=db_obj.tanggal_beli,
                    sumber=HutangSource.LAINNYA,
                    referensi_id=db_obj.id,
                    nomor_referensi=db_obj.kode,
                    supplier_id=obj_in.supplier_id,
                    nama_kreditur=kreditur,
                    nominal_hutang=sisa_hutang,
                    total_dibayar=Decimal("0"),
                    sisa_hutang=sisa_hutang,
                    status=HutangStatus.BELUM_LUNAS,
                    catatan=f"Hutang pembelian aset {db_obj.kode} - {db_obj.nama}",
                    created_by=user_id,
                ))
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        self.db.refresh(db_obj)
        return db_obj

    def get(self, id: int) -> Optional[Aset]:
        """Get asset by ID."""
        return self.db.query(Aset).filter(Aset.id == id).first()

    def get_list(
        self,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        kategori: Optional[str] = None,
        status: Optional[AssetStatus] = None,
    ) -> dict:
        """Get list of assets with filters."""
        query = self.db.query(Aset)

        if search:
            query = query.filter(
                or_(
                    Aset.nama.ilike(f"%{search}%"),
                    Aset.kode.ilike(f"%{search}%"),
                    Aset.lokasi.ilike(f"%{search}%"),
                )
            )

        if kategori and kategori != "all":
            query = query.filter(Aset.kategori == kategori)

        if status:
            query = query.filter(Aset.status == status)

        total = query.count()
        data = query.order_by(Aset.created_at.desc()).offset(skip).limit(limit).all()
        
        # Calculate total value
        total_value = self.db.query(func.sum(Aset.harga_beli)).filter(Aset.status == AssetStatus.AKTIF).scalar() or 0

        return {
            "data": data,
            "total": total,
            "total_value": Decimal(total_value),
        }

    def update(self, id: int, obj_in: AssetUpdate) -> Optional[Aset]:
        """Update an asset."""
        db_obj = self.get(id)
        if not db_obj:
            return None

        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)

        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    def delete(self, id: int) -> bool:
        """Hapus aset. Kas pembelian dibalik dengan jurnal [VOID]; hutang yang
        belum dibayar ikut dihapus. Hutang yang sudah dicicil -> tolak."""
        db_obj = self.get(id)
        if not db_obj:
            return False

        hutang_rows = self.db.query(HutangUsaha).filter(
            HutangUsaha.referensi_id == db_obj.id,
            HutangUsaha.nomor_referensi == db_obj.kode,
            HutangUsaha.status != HutangStatus.BATAL,
        ).all()
        if any((h.total_dibayar or 0) > 0 for h in hutang_rows):
            raise HTTPException(
                http_status.HTTP_400_BAD_REQUEST,
                "Hutang pembelian aset ini sudah dibayar sebagian — batalkan pembayarannya dulu",
            )

        kas_rows = self.db.query(KasBank).filter(
            KasBank.sumber == KasBankSource.ASET,
            KasBank.referensi_id == db_obj.id,
            KasBank.nomor_referensi == db_obj.kode,
            ~KasBank.keterangan.like("[VOID]%"),
        ).all()
        try:
            if kas_rows:
                from app.services.kas_bank_integration import create_kas_entry
                for kb in kas_rows:
                    create_kas_entry(
                        db=self.db,
                        tanggal=date.today(),
                        tipe=KasBankType.MASUK if kb.tipe == KasBankType.KELUAR else KasBankType.KELUAR,
                        nominal=kb.nominal,
                        sumber=KasBankSource.ASET,
                        metode_bayar=kb.metode_bayar,
                        referensi_id=kb.referensi_id,
                        nomor_referensi=kb.nomor_referensi,
                        keterangan=f"[VOID] Hapus aset: {kb.keterangan}",
                        kas_jenis=kb.jenis,
                        allow_negative=True,
                        commit=False,
                    )
            # Belum ada pembayaran -> hapus. Status BATAL saja tidak cukup:
            # Neraca menjumlah nominal hutang eksternal tanpa melihat status.
            for h in hutang_rows:
                self.db.delete(h)
            self.db.delete(db_obj)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        return True

    def get_summary(self) -> dict:
        """Get summary of assets for dashboard/reports."""
        total_value = self.db.query(func.sum(Aset.harga_beli)).filter(Aset.status == AssetStatus.AKTIF).scalar() or 0
        count_by_kategori = (
            self.db.query(Aset.kategori, func.count(Aset.id))
            .group_by(Aset.kategori)
            .all()
        )
        
        # The following print statement refers to variables not defined in this context.
        # Assuming these are placeholders for future calculations or belong to a different service.
        # For now, they are commented out to maintain syntactical correctness.
        # print(f"DEBUG NERACA AKTIVA: Kas={total_kas_bank}, Piutang={total_piutang}, Persediaan={persediaan_sparepart}, Mobil={stok_mobil_total}")
        
        return {
            "total_value": Decimal(total_value),
            "by_kategori": {str(k.value): v for k, v in count_by_kategori},
        }
