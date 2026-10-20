"""Perbaikan data keuangan dari dashboard monitoring (khusus ADMIN/MANAGER).

Dua kelompok temuan:
- Piutang manual tanpa kas: piutang LAINNYA yang dibuat dari form tanpa metode
  pencairan, sehingga tidak punya baris kas. Perbaikan: catat kas keluar
  (uang memang keluar) atau batalkan piutang (uang tidak pernah keluar).
- Tanggal mundur: baris kas yang tanggalnya lebih awal dari tanggal input
  (dibuat_pada - tanggal = selisih hari). Perbaikan: pindahkan tanggal baris kas
  dan induknya (piutang, hutang, transaksi bengkel) lalu hitung ulang saldo.
"""
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy import func, or_

from app.models.bengkel import TransaksiPenjualanBengkel
from app.models.keuangan import HutangUsaha, KasBank, PiutangUsaha
from app.services.kas_bank_integration import create_kas_entry, get_kas_jenis
from app.services.kas_bank_service import KasBankService
from app.utils.constants import (
    KasBankJenis,
    KasBankSource,
    KasBankType,
    PaymentMethod,
    PiutangSource,
    PiutangStatus,
)
from app.utils.helpers import pesan_tanggal_masa_depan

# Akun yang boleh dipilih untuk pencairan tunai: kas utama dan laci tiap unit.
AKUN_TUNAI = {
    KasBankJenis.KAS_UTAMA,
    KasBankJenis.KAS_UNIT_BENGKEL,
    KasBankJenis.KAS_UNIT_JASA_ANGKUT,
    KasBankJenis.KAS_UNIT_MOBIL,
}
AKUN_TRANSFER = {KasBankJenis.BANK_UTAMA}


class PerbaikanDataService:
    def __init__(self, db):
        self.db = db

    # ------------------------------------------------------------------
    # Piutang manual tanpa kas
    # ------------------------------------------------------------------
    def _kandidat_piutang_manual(self):
        return (
            self.db.query(PiutangUsaha)
            .filter(
                PiutangUsaha.sumber == PiutangSource.LAINNYA,
                PiutangUsaha.referensi_id.is_(None),
                PiutangUsaha.nomor_referensi.is_(None),
                PiutangUsaha.is_internal == False,  # noqa: E712
                PiutangUsaha.status != PiutangStatus.BATAL,
            )
        )

    def _punya_kas(self, nomor_piutang: str) -> bool:
        return (
            self.db.query(KasBank.id)
            .filter(KasBank.nomor_referensi == nomor_piutang)
            .first()
            is not None
        )

    def piutang_tanpa_kas(self) -> List[Dict[str, Any]]:
        hasil = []
        for p in self._kandidat_piutang_manual().order_by(PiutangUsaha.tanggal, PiutangUsaha.id).all():
            if self._punya_kas(p.nomor_piutang):
                continue
            hasil.append({
                "id": p.id,
                "nomor_piutang": p.nomor_piutang,
                "tanggal": p.tanggal.isoformat(),
                "nama_debitur": p.nama_debitur,
                "nominal_piutang": float(p.nominal_piutang),
                "catatan": p.catatan,
            })
        return hasil

    def _ambil_piutang_manual_tanpa_kas(self, piutang_id: int) -> PiutangUsaha:
        p = self.db.get(PiutangUsaha, piutang_id)
        if p is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Piutang tidak ditemukan")
        if self._kandidat_piutang_manual().filter(PiutangUsaha.id == piutang_id).first() is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Piutang ini bukan piutang manual tanpa kas",
            )
        if self._punya_kas(p.nomor_piutang):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Piutang ini sudah punya catatan kas",
            )
        return p

    def catat_kas_piutang(
        self,
        piutang_id: int,
        metode: PaymentMethod,
        kas_jenis: Optional[KasBankJenis],
        user_id: Optional[int],
    ) -> Dict[str, Any]:
        p = self._ambil_piutang_manual_tanpa_kas(piutang_id)
        akun_valid = AKUN_TUNAI if metode == PaymentMethod.TUNAI else AKUN_TRANSFER
        if kas_jenis is None:
            kas_jenis = get_kas_jenis(metode, p.unit)
        if kas_jenis not in akun_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Akun {kas_jenis.value} tidak sesuai metode {metode.value}",
            )
        create_kas_entry(
            db=self.db,
            tanggal=p.tanggal,
            tipe=KasBankType.KELUAR,
            nominal=p.nominal_piutang,
            sumber=p.unit or KasBankSource.PIUTANG,
            metode_bayar=metode,
            referensi_id=p.id,
            nomor_referensi=p.nomor_piutang,
            keterangan=f"[Perbaikan] Pemberian piutang kepada {p.nama_debitur} ({metode.value})",
            user_id=user_id,
            kas_jenis=kas_jenis,
            commit=True,
        )
        return {
            "id": p.id,
            "nomor_piutang": p.nomor_piutang,
            "metode": metode.value,
            "kas_jenis": kas_jenis.value,
        }

    def batalkan_piutang(self, piutang_id: int) -> Dict[str, Any]:
        p = self._ambil_piutang_manual_tanpa_kas(piutang_id)
        p.status = PiutangStatus.BATAL
        p.sisa_piutang = 0
        p.catatan = f"{p.catatan or ''} [Dibatalkan lewat Perbaikan Data: tidak ada uang keluar]".strip()
        self.db.commit()
        return {"id": p.id, "nomor_piutang": p.nomor_piutang, "status": PiutangStatus.BATAL.value}

    # ------------------------------------------------------------------
    # Tanggal mundur
    # ------------------------------------------------------------------
    def tanggal_mundur(self, selisih_hari: int = 1) -> List[Dict[str, Any]]:
        rows = (
            self.db.query(
                KasBank.nomor_referensi,
                KasBank.tanggal,
                func.max(func.date(KasBank.created_at)).label("dibuat_pada"),
                func.count(KasBank.id).label("jumlah_baris"),
                func.sum(KasBank.nominal).label("total"),
                func.min(KasBank.keterangan).label("keterangan"),
            )
            .filter(
                KasBank.nomor_referensi.isnot(None),
                ~KasBank.nomor_referensi.like("IMP-%"),
                func.datediff(func.date(KasBank.created_at), KasBank.tanggal) == selisih_hari,
            )
            .group_by(KasBank.nomor_referensi, KasBank.tanggal)
            .order_by(KasBank.tanggal, KasBank.nomor_referensi)
            .all()
        )
        hasil = []
        for nomor, tanggal_lama, dibuat_pada, jumlah, total, keterangan in rows:
            hasil.append({
                "nomor_referensi": nomor,
                "tanggal_lama": tanggal_lama.isoformat(),
                "tanggal_seharusnya": dibuat_pada.isoformat(),
                "jumlah_baris": int(jumlah),
                "total": float(total or 0),
                "keterangan": keterangan,
                "induk": self._cari_induk(nomor),
            })
        return hasil

    def _cari_induk(self, nomor: str) -> Optional[str]:
        if self.db.query(PiutangUsaha.id).filter(
            or_(PiutangUsaha.nomor_piutang == nomor, PiutangUsaha.nomor_referensi == nomor)
        ).first():
            return "PIUTANG"
        if self.db.query(HutangUsaha.id).filter(
            or_(HutangUsaha.nomor_hutang == nomor, HutangUsaha.nomor_referensi == nomor)
        ).first():
            return "HUTANG"
        if self.db.query(TransaksiPenjualanBengkel.id).filter(
            TransaksiPenjualanBengkel.nomor_transaksi == nomor
        ).first():
            return "TRANSAKSI_BENGKEL"
        return None

    def ubah_tanggal(self, nomor_referensi: str, tanggal_lama, tanggal_baru) -> Dict[str, Any]:
        pesan = pesan_tanggal_masa_depan(tanggal_baru)
        if pesan:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=pesan)

        kas = (
            self.db.query(KasBank)
            .filter(KasBank.nomor_referensi == nomor_referensi, KasBank.tanggal == tanggal_lama)
            .all()
        )
        if not kas:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tidak ada baris kas pada tanggal tersebut")
        for row in kas:
            row.tanggal = tanggal_baru

        induk = (
            self.db.query(PiutangUsaha)
            .filter(
                or_(PiutangUsaha.nomor_piutang == nomor_referensi, PiutangUsaha.nomor_referensi == nomor_referensi),
                PiutangUsaha.tanggal == tanggal_lama,
            )
            .all()
        )
        induk += (
            self.db.query(HutangUsaha)
            .filter(
                or_(HutangUsaha.nomor_hutang == nomor_referensi, HutangUsaha.nomor_referensi == nomor_referensi),
                HutangUsaha.tanggal == tanggal_lama,
            )
            .all()
        )
        induk += (
            self.db.query(TransaksiPenjualanBengkel)
            .filter(
                TransaksiPenjualanBengkel.nomor_transaksi == nomor_referensi,
                TransaksiPenjualanBengkel.tanggal == tanggal_lama,
            )
            .all()
        )
        for row in induk:
            row.tanggal = tanggal_baru

        self.db.flush()
        KasBankService(self.db).rebuild_balances()
        self.db.commit()
        return {
            "nomor_referensi": nomor_referensi,
            "baris_kas": len(kas),
            "dokumen_induk": len(induk),
            "tanggal_baru": tanggal_baru.isoformat(),
        }
