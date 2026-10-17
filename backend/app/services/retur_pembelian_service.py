"""Retur barang pembelian spare part ke supplier.

Efek satu retur (nilai R = qty x harga_satuan baris pembelian):
- Stok part berkurang qty (kecuali stok always-ready). Persediaan dinilai
  stok x harga_beli, jadi retur hanya diizinkan bila harga_beli sama dengan
  harga_satuan baris: nilai persediaan yang keluar sama dengan R.
- Hutang pembelian yang masih terbuka dikurangi dulu (nilai_hutang).
- Sisanya dikembalikan supplier ke kas MASUK (nilai_kas), dengan metode refund.
- Pembatalan (void) membalik ketiganya; kas dibalik dengan entri [VOID].
"""
from datetime import datetime, date
from decimal import Decimal
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.bengkel import (
    DetailPembelianSparePart,
    DetailReturPembelianSparePart,
    PembelianSparePart,
    ReturPembelianSparePart,
    SparePart,
)
from app.models.keuangan import HutangUsaha, KasBank, PiutangUsaha
from app.schemas.bengkel import ReturPembelianCreate
from app.services.kas_bank_integration import create_kas_entry
from app.utils.constants import (
    HutangSource,
    HutangStatus,
    KasBankSource,
    KasBankType,
    PaymentStatus,
    PiutangSource,
    PiutangStatus,
    TRANSACTION_PREFIXES,
)
from app.utils.sparepart_stock import is_always_ready_stock


class ReturPembelianService:
    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------ helpers
    def _generate_nomor(self) -> str:
        prefix = TRANSACTION_PREFIXES["retur_pembelian"]
        date_str = datetime.now().strftime("%y%m%d")
        last = (
            self.db.query(ReturPembelianSparePart)
            .filter(ReturPembelianSparePart.nomor_retur.like(f"{prefix}{date_str}%"))
            .order_by(ReturPembelianSparePart.id.desc())
            .first()
        )
        new_num = int(last.nomor_retur[-4:]) + 1 if last else 1
        return f"{prefix}{date_str}{new_num:04d}"

    def _generate_nomor_piutang(self) -> str:
        prefix = TRANSACTION_PREFIXES["piutang"]
        date_str = datetime.now().strftime("%y%m%d")
        last = (
            self.db.query(PiutangUsaha)
            .filter(PiutangUsaha.nomor_piutang.like(f"{prefix}{date_str}%"))
            .order_by(PiutangUsaha.id.desc())
            .first()
        )
        new_num = int(last.nomor_piutang[-4:]) + 1 if last else 1
        return f"{prefix}{date_str}{new_num:04d}"

    def _piutang_retur(self, retur: ReturPembelianSparePart) -> Optional[PiutangUsaha]:
        return (
            self.db.query(PiutangUsaha)
            .filter(
                PiutangUsaha.sumber == PiutangSource.LAINNYA,
                PiutangUsaha.referensi_id == retur.id,
                PiutangUsaha.nomor_referensi == retur.nomor_retur,
            )
            .first()
        )

    def _get_pembelian(self, pembelian_id: int) -> PembelianSparePart:
        pembelian = self.db.query(PembelianSparePart).filter(PembelianSparePart.id == pembelian_id).first()
        if not pembelian:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pembelian tidak ditemukan")
        return pembelian

    def _get_retur(self, retur_id: int) -> ReturPembelianSparePart:
        retur = self.db.query(ReturPembelianSparePart).filter(ReturPembelianSparePart.id == retur_id).first()
        if not retur:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retur tidak ditemukan")
        return retur

    def _hutang_pembelian(self, pembelian: PembelianSparePart) -> Optional[HutangUsaha]:
        return (
            self.db.query(HutangUsaha)
            .filter(
                HutangUsaha.sumber == HutangSource.PEMBELIAN_PART,
                HutangUsaha.referensi_id == pembelian.id,
                HutangUsaha.nomor_referensi == pembelian.nomor_transaksi,
            )
            .order_by(HutangUsaha.id.asc())
            .first()
        )

    def _sudah_diretur(self, detail_id: int) -> Decimal:
        total = (
            self.db.query(func.coalesce(func.sum(DetailReturPembelianSparePart.qty), 0))
            .join(ReturPembelianSparePart, ReturPembelianSparePart.id == DetailReturPembelianSparePart.retur_id)
            .filter(
                DetailReturPembelianSparePart.detail_pembelian_id == detail_id,
                ReturPembelianSparePart.dibatalkan.is_(False),
            )
            .scalar()
        )
        return Decimal(str(total or 0))

    @staticmethod
    def _recalc_hutang_status(hutang: HutangUsaha) -> None:
        if hutang.sisa_hutang <= 0:
            hutang.sisa_hutang = Decimal("0")
            hutang.status = HutangStatus.LUNAS
        elif hutang.total_dibayar and hutang.total_dibayar > 0:
            hutang.status = HutangStatus.SEBAGIAN
        else:
            hutang.status = HutangStatus.BELUM_LUNAS

    # ------------------------------------------------------------------ queries
    def list_for_pembelian(self, pembelian_id: int) -> List[ReturPembelianSparePart]:
        self._get_pembelian(pembelian_id)
        return (
            self.db.query(ReturPembelianSparePart)
            .filter(ReturPembelianSparePart.pembelian_id == pembelian_id)
            .order_by(ReturPembelianSparePart.id.asc())
            .all()
        )

    def ada_retur_aktif(self, pembelian_id: int) -> bool:
        return (
            self.db.query(ReturPembelianSparePart.id)
            .filter(
                ReturPembelianSparePart.pembelian_id == pembelian_id,
                ReturPembelianSparePart.dibatalkan.is_(False),
            )
            .first()
            is not None
        )

    # ------------------------------------------------------------------ commands
    def _rencana(self, pembelian: PembelianSparePart, data: ReturPembelianCreate) -> dict:
        """Validasi dan hitung pembagian retur (hutang vs kas) tanpa menulis apa pun."""
        detail_map = {d.id: d for d in pembelian.detail}

        qty_per_baris: dict = {}
        for item in data.detail:
            if item.detail_pembelian_id not in detail_map:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Baris {item.detail_pembelian_id} bukan bagian dari pembelian {pembelian.nomor_transaksi}",
                )
            qty_per_baris[item.detail_pembelian_id] = qty_per_baris.get(item.detail_pembelian_id, Decimal("0")) + Decimal(str(item.qty))

        lines = []
        total = Decimal("0")
        for detail_id, qty in qty_per_baris.items():
            det: DetailPembelianSparePart = detail_map[detail_id]
            part = (
                self.db.query(SparePart)
                .filter(SparePart.id == det.spare_part_id)
                .with_for_update()
                .first()
            )
            if part is None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Sparepart #{det.spare_part_id} tidak ditemukan")
            nama = part.nama
            sisa = Decimal(str(det.qty)) - self._sudah_diretur(det.id)
            if qty > sisa:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Qty retur {nama} melebihi sisa yang bisa diretur ({sisa}).",
                )
            if not is_always_ready_stock(part.stok) and Decimal(str(part.stok)) < qty:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Stok {nama} ({part.stok}) tidak cukup untuk diretur {qty}. Mungkin sudah terjual.",
                )
            if Decimal(str(part.harga_beli)) != Decimal(str(det.harga_satuan)):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Harga beli {nama} sudah berubah sejak pembelian ini "
                        f"({det.harga_satuan} → {part.harga_beli}). Retur hanya bisa untuk harga yang masih berlaku."
                    ),
                )
            subtotal = qty * Decimal(str(det.harga_satuan))
            total += subtotal
            lines.append((det, part, qty, subtotal))

        hutang = self._hutang_pembelian(pembelian)
        hutang_terbuka = (
            hutang is not None
            and hutang.status in (HutangStatus.BELUM_LUNAS, HutangStatus.SEBAGIAN)
            and hutang.sisa_hutang > 0
        )
        nilai_hutang = min(total, Decimal(str(hutang.sisa_hutang))) if hutang_terbuka else Decimal("0")
        # Sisa setelah memotong hutang: dicairkan ke kas, atau jadi piutang ke supplier.
        selisih = total - nilai_hutang
        nilai_kas = selisih if data.selisih_sebagai == "KAS" else Decimal("0")
        nilai_piutang = selisih if data.selisih_sebagai == "PIUTANG" else Decimal("0")

        return {
            "lines": lines,
            "total": total,
            "hutang": hutang if hutang_terbuka else None,
            "nilai_hutang": nilai_hutang,
            "nilai_kas": nilai_kas,
            "nilai_piutang": nilai_piutang,
        }

    def preview(self, pembelian_id: int, data: ReturPembelianCreate) -> dict:
        """Pratinjau pembagian retur; tidak menulis apa pun ke database."""
        pembelian = self._get_pembelian(pembelian_id)
        r = self._rencana(pembelian, data)
        return {
            "total_retur": r["total"],
            "nilai_hutang": r["nilai_hutang"],
            "nilai_kas": r["nilai_kas"],
            "nilai_piutang": r["nilai_piutang"],
            "sisa_hutang_sebelum": Decimal(str(r["hutang"].sisa_hutang)) if r["hutang"] is not None else Decimal("0"),
            "lines": [
                {"detail_pembelian_id": det.id, "spare_part_nama": part.nama, "qty": qty, "subtotal": subtotal}
                for det, part, qty, subtotal in r["lines"]
            ],
        }

    def create(self, pembelian_id: int, data: ReturPembelianCreate, user_id: Optional[int] = None) -> ReturPembelianSparePart:
        pembelian = self._get_pembelian(pembelian_id)
        r = self._rencana(pembelian, data)
        lines = r["lines"]
        total = r["total"]
        hutang = r["hutang"]
        nilai_hutang = r["nilai_hutang"]
        nilai_kas = r["nilai_kas"]
        nilai_piutang = r["nilai_piutang"]

        if nilai_kas > 0 and data.metode_refund is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Pilih metode pengembalian dana dari supplier untuk sisa Rp{nilai_kas:,.0f}.",
            )

        retur = ReturPembelianSparePart(
            nomor_retur=self._generate_nomor(),
            pembelian_id=pembelian.id,
            tanggal=data.tanggal,
            total_retur=total,
            nilai_hutang=nilai_hutang,
            nilai_kas=nilai_kas,
            nilai_piutang=nilai_piutang,
            metode_refund=data.metode_refund if nilai_kas > 0 else None,
            catatan=data.catatan,
            created_by=user_id,
        )
        self.db.add(retur)
        self.db.flush()

        for det, part, qty, subtotal in lines:
            self.db.add(DetailReturPembelianSparePart(
                retur_id=retur.id,
                detail_pembelian_id=det.id,
                spare_part_id=part.id,
                qty=qty,
                harga_satuan=det.harga_satuan,
                subtotal=subtotal,
            ))
            if not is_always_ready_stock(part.stok):
                part.stok = Decimal(str(part.stok)) - qty

        if hutang is not None and nilai_hutang > 0:
            hutang.nominal_hutang = Decimal(str(hutang.nominal_hutang)) - nilai_hutang
            hutang.sisa_hutang = Decimal(str(hutang.sisa_hutang)) - nilai_hutang
            self._recalc_hutang_status(hutang)
            if hutang.status == HutangStatus.LUNAS:
                pembelian.status_bayar = PaymentStatus.LUNAS
                pembelian.tanggal_bayar = data.tanggal

        if nilai_kas > 0:
            create_kas_entry(
                db=self.db,
                tanggal=data.tanggal,
                tipe=KasBankType.MASUK,
                nominal=nilai_kas,
                sumber=KasBankSource.PEMBELIAN_PART,
                metode_bayar=data.metode_refund,
                referensi_id=retur.id,
                nomor_referensi=retur.nomor_retur,
                keterangan=f"Refund retur pembelian {pembelian.nomor_transaksi} ({retur.nomor_retur}) ({data.metode_refund.value})",
                user_id=user_id,
                kas_jenis=data.kas_jenis,
                commit=False,
            )

        if nilai_piutang > 0:
            supplier = pembelian.supplier
            self.db.add(PiutangUsaha(
                nomor_piutang=self._generate_nomor_piutang(),
                tanggal=data.tanggal,
                sumber=PiutangSource.LAINNYA,
                referensi_id=retur.id,
                nomor_referensi=retur.nomor_retur,
                nama_debitur=supplier.nama if supplier else "Supplier",
                telepon_debitur=supplier.telepon if supplier else None,
                alamat_debitur=supplier.alamat if supplier else None,
                nominal_piutang=nilai_piutang,
                total_dibayar=Decimal("0"),
                sisa_piutang=nilai_piutang,
                status=PiutangStatus.BELUM_LUNAS,
                catatan=f"Piutang ke supplier dari retur pembelian {pembelian.nomor_transaksi} ({retur.nomor_retur})",
                created_by=user_id,
            ))

        self.db.commit()
        self.db.refresh(retur)
        return retur

    def void(self, retur_id: int, user_id: Optional[int] = None) -> ReturPembelianSparePart:
        retur = self._get_retur(retur_id)
        if retur.dibatalkan:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Retur sudah dibatalkan")
        pembelian = self._get_pembelian(retur.pembelian_id)

        for d in retur.detail:
            part = self.db.query(SparePart).filter(SparePart.id == d.spare_part_id).with_for_update().first()
            if part is not None and not is_always_ready_stock(part.stok):
                part.stok = Decimal(str(part.stok)) + Decimal(str(d.qty))

        if retur.nilai_hutang > 0:
            hutang = self._hutang_pembelian(pembelian)
            if hutang is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Hutang pembelian tidak ditemukan; batalkan retur ini secara manual.",
                )
            hutang.nominal_hutang = Decimal(str(hutang.nominal_hutang)) + retur.nilai_hutang
            hutang.sisa_hutang = Decimal(str(hutang.sisa_hutang)) + retur.nilai_hutang
            self._recalc_hutang_status(hutang)
            if hutang.sisa_hutang > 0 and pembelian.status_bayar == PaymentStatus.LUNAS:
                pembelian.status_bayar = PaymentStatus.BELUM_LUNAS
                pembelian.tanggal_bayar = None

        if retur.nilai_kas > 0:
            kas_asal = (
                self.db.query(KasBank)
                .filter(
                    KasBank.nomor_referensi == retur.nomor_retur,
                    KasBank.sumber == KasBankSource.PEMBELIAN_PART,
                    KasBank.tipe == KasBankType.MASUK,
                )
                .first()
            )
            create_kas_entry(
                db=self.db,
                tanggal=date.today(),
                tipe=KasBankType.KELUAR,
                nominal=retur.nilai_kas,
                sumber=KasBankSource.PEMBELIAN_PART,
                metode_bayar=retur.metode_refund,
                referensi_id=retur.id,
                nomor_referensi=retur.nomor_retur,
                keterangan=f"[VOID] Refund retur {retur.nomor_retur} dibatalkan",
                user_id=user_id,
                kas_jenis=kas_asal.jenis if kas_asal else None,
                allow_negative=True,
                commit=False,
            )

        if retur.nilai_piutang > 0:
            piutang = self._piutang_retur(retur)
            if piutang is not None:
                if Decimal(str(piutang.total_dibayar or 0)) > 0:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Piutang ke supplier {piutang.nomor_piutang} sudah dibayar. Batalkan pembayarannya dulu.",
                    )
                piutang.status = PiutangStatus.BATAL
                piutang.sisa_piutang = Decimal("0")

        retur.dibatalkan = True
        self.db.commit()
        self.db.refresh(retur)
        return retur
