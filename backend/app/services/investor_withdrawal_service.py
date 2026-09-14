"""Penarikan dana investor saat mobil belum terjual (pengembalian modal saja)."""
from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from app.models.mobil import Mobil, InvestorWithdrawal
from app.models.keuangan import KasBank
from app.services.kas_bank_integration import create_kas_entry
from app.utils.constants import (
    CarStatus,
    KasBankJenis,
    KasBankSource,
    KasBankType,
    OwnershipType,
    PaymentMethod,
)

KETERANGAN_PREFIX = "Penarikan Dana Investor"


class InvestorWithdrawalService:
    def __init__(self, db: Session):
        self.db = db

    # ---------------------------------------------------------------- queries
    def _current_balance(self, jenis: KasBankJenis) -> Decimal:
        masuk = self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.jenis == jenis, KasBank.tipe == KasBankType.MASUK
        ).scalar() or 0
        keluar = self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.jenis == jenis, KasBank.tipe == KasBankType.KELUAR
        ).scalar() or 0
        return Decimal(str(masuk)) - Decimal(str(keluar))

    def _withdrawal_sum(self, mobil_id: int) -> Decimal:
        total = (
            self.db.query(func.sum(InvestorWithdrawal.nominal))
            .filter(
                InvestorWithdrawal.mobil_id == mobil_id,
                ~InvestorWithdrawal.catatan.ilike("[REVERSED]%"),
            )
            .scalar()
        )
        return Decimal(str(total or 0))

    def get_unsold_cars(self, nama_investor: Optional[str] = None) -> List[Dict[str, Any]]:
        """Mobil investor yang belum terjual + sisa dana yang masih bisa ditarik."""
        query = self.db.query(Mobil).filter(
            Mobil.tipe_kepemilikan == OwnershipType.INVESTOR,
            Mobil.status != CarStatus.TERJUAL,
            Mobil.deleted_at.is_(None),
        )
        if nama_investor:
            query = query.filter(Mobil.nama_investor.ilike(f"%{nama_investor}%"))

        result = []
        for mobil in query.order_by(Mobil.tanggal_masuk.desc()).all():
            nominal = Decimal(str(mobil.nominal_investor or 0))
            ditarik = self._withdrawal_sum(mobil.id)
            sisa = nominal - ditarik
            # Dana habis ditarik: unit keluar dari daftar (muncul lagi jika direversal).
            if sisa <= 0:
                continue
            result.append({
                "id": mobil.id,
                "kode": mobil.kode,
                "mobil": f"{mobil.merek} {mobil.model} ({mobil.nomor_plat})",
                "nama_investor": mobil.nama_investor,
                "persentase_investor": float(mobil.persentase_investor or 0),
                "nominal_investor": float(nominal),
                "total_ditarik": float(ditarik),
                "sisa_bisa_ditarik": float(sisa),
                "tanggal_masuk": mobil.tanggal_masuk.isoformat() if mobil.tanggal_masuk else None,
                "status": mobil.status.value if hasattr(mobil.status, "value") else str(mobil.status),
            })
        return result

    def get_history(
        self,
        nama_investor: Optional[str] = None,
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
    ) -> List[Dict[str, Any]]:
        query = (
            self.db.query(InvestorWithdrawal)
            .join(InvestorWithdrawal.mobil)
            .options(joinedload(InvestorWithdrawal.mobil))
        )
        if nama_investor:
            query = query.filter(Mobil.nama_investor.ilike(f"%{nama_investor}%"))
        if tanggal_dari:
            query = query.filter(InvestorWithdrawal.tanggal >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(InvestorWithdrawal.tanggal <= tanggal_sampai)

        rows = query.order_by(
            InvestorWithdrawal.tanggal.desc(), InvestorWithdrawal.id.desc()
        ).all()

        return [
            {
                "id": r.id,
                "mobil_id": r.mobil_id,
                "mobil": f"{r.mobil.merek} {r.mobil.model} ({r.mobil.nomor_plat})" if r.mobil else "-",
                "nama_investor": r.mobil.nama_investor if r.mobil else None,
                "tanggal": r.tanggal.isoformat(),
                "nominal": float(r.nominal),
                "metode_bayar": r.metode_bayar.value if hasattr(r.metode_bayar, "value") else str(r.metode_bayar),
                "catatan": r.catatan,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]

    # --------------------------------------------------------------- mutation
    def create_withdrawal(
        self,
        mobil_id: int,
        payment_entries: List[tuple[PaymentMethod, Decimal, Optional[KasBankJenis]]],
        total_nominal: Optional[Decimal] = None,
        tanggal: Optional[date] = None,
        catatan: str = "",
        user_id: Optional[int] = None,
    ) -> List[InvestorWithdrawal]:
        """payment_entries: (metode, nominal, kas_jenis). kas_jenis None → dompet unit mobil."""
        mobil = (
            self.db.query(Mobil)
            .filter(Mobil.id == mobil_id, Mobil.deleted_at.is_(None))
            .first()
        )
        if not mobil:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Mobil tidak ditemukan",
            )

        if mobil.tipe_kepemilikan != OwnershipType.INVESTOR:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mobil ini bukan milik investor",
            )

        if mobil.status == CarStatus.TERJUAL:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mobil sudah terjual, gunakan alur pencairan setelah penjualan",
            )

        sisa = Decimal(str(mobil.nominal_investor or 0)) - self._withdrawal_sum(mobil.id)

        if total_nominal is None:
            total_nominal = sum((n for _, n, _ in payment_entries), Decimal("0"))
            if total_nominal == 0 and len(payment_entries) == 1:
                total_nominal = sisa
                metode0, _, jenis0 = payment_entries[0]
                payment_entries = [(metode0, sisa, jenis0)]

        total_nominal = Decimal(str(total_nominal))
        if total_nominal <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nominal penarikan harus lebih dari 0",
            )

        if total_nominal > sisa:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Melebihi sisa dana investor (sisa: {sisa})",
            )

        total_input = sum((n for _, n, _ in payment_entries), Decimal("0"))
        if total_input != total_nominal:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Total rincian pembayaran ({total_input}) tidak sesuai dengan total penarikan ({total_nominal})",
            )

        tanggal_penarikan = tanggal or date.today()
        nama = mobil.nama_investor or "-"
        dibuat: List[InvestorWithdrawal] = []

        # Saldo akun-akun yang dipilih, dihitung sekali (satu penarikan = satu akun per metode).
        saldo_awal = {
            jenis: self._current_balance(jenis)
            for jenis in {e[2] or KasBankJenis.KAS_UNIT_MOBIL for e in payment_entries}
        }

        for metode, nominal, kas_jenis in payment_entries:
            if nominal <= 0:
                continue

            akun = kas_jenis or KasBankJenis.KAS_UNIT_MOBIL
            if nominal > saldo_awal[akun]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Saldo tidak mencukupi. Saldo {akun.value}: {saldo_awal[akun]}",
                )
            saldo_awal[akun] -= nominal

            row = InvestorWithdrawal(
                mobil_id=mobil.id,
                tanggal=tanggal_penarikan,
                nominal=nominal,
                metode_bayar=metode,
                catatan=catatan or f"Penarikan dana investor {nama}",
                created_by=user_id,
            )
            self.db.add(row)

            # Kas keluar bersumber HUTANG: simetris dengan penerimaan dana investor
            # (mobil_service) sehingga Setoran Modal tidak terpengaruh.
            create_kas_entry(
                db=self.db,
                tanggal=tanggal_penarikan,
                tipe=KasBankType.KELUAR,
                nominal=nominal,
                sumber=KasBankSource.HUTANG,
                metode_bayar=metode,
                referensi_id=mobil.id,
                nomor_referensi=mobil.kode,
                keterangan=f"{KETERANGAN_PREFIX} {nama} ({metode}) - {mobil.merek} ({mobil.nomor_plat})",
                user_id=user_id,
                kas_jenis=akun,
                allow_negative=False,
                commit=False,
            )
            dibuat.append(row)

        if not dibuat:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak ada nominal penarikan yang valid",
            )

        self.db.commit()
        for row in dibuat:
            self.db.refresh(row)
        return dibuat

    def reverse_withdrawal(
        self,
        withdrawal_id: int,
        alasan: str = "",
        user_id: Optional[int] = None,
    ) -> InvestorWithdrawal:
        row = (
            self.db.query(InvestorWithdrawal)
            .options(joinedload(InvestorWithdrawal.mobil))
            .filter(InvestorWithdrawal.id == withdrawal_id)
            .first()
        )
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Penarikan dana tidak ditemukan",
            )

        if "[REVERSED]" in (row.catatan or ""):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Penarikan dana ini sudah pernah direversal",
            )

        mobil = row.mobil
        # ponytail: kas lama tidak menyimpan id penarikan, jadi dicocokkan lewat
        # keterangan+metode+tanggal+nominal dan dibalik satu entri saja. Kalau
        # butuh pairing presisi, simpan withdrawal.id di kolom baru kas_bank.
        entry = (
            self.db.query(KasBank)
            .filter(
                KasBank.referensi_id == mobil.id,
                KasBank.tipe == KasBankType.KELUAR,
                KasBank.keterangan.ilike(f"{KETERANGAN_PREFIX}%"),
                KasBank.metode_bayar == row.metode_bayar,
                KasBank.tanggal == row.tanggal,
                KasBank.nominal == row.nominal,
            )
            .order_by(KasBank.id.desc())
            .first()
        )

        if entry:
            create_kas_entry(
                db=self.db,
                tanggal=date.today(),
                tipe=KasBankType.MASUK,
                nominal=entry.nominal,
                sumber=entry.sumber,
                metode_bayar=entry.metode_bayar,
                referensi_id=mobil.id,
                nomor_referensi=mobil.kode,
                keterangan=f"[REVERSAL] Pembalikan {entry.keterangan}",
                user_id=user_id,
                kas_jenis=entry.jenis,
                allow_negative=True,
            )

        current_note = (row.catatan or "").strip()
        row.catatan = f"[REVERSED] {current_note}".strip()
        if alasan:
            row.catatan = f"{row.catatan} | {alasan}"

        self.db.commit()
        self.db.refresh(row)
        return row
