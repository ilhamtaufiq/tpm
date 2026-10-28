"""Pembatalan transaksi keuangan: jurnal dibalik, data asli tetap ada.

Aturan (lihat invariant 35 di TPM - Aturan Bisnis & Invariant):
- Tidak ada DELETE. Jurnal asli dan jurnal balik `[VOID]` diberi `dibatalkan_at`
  dan disembunyikan dari semua SELECT (`app/models/pembatalan_filter.py`), jadi
  laporan, saldo, dan dashboard menghitung seolah transaksinya tidak pernah ada.
  Jurnal tetap ada di DB dan nomornya tercatat di riwayat.
- Tanggal jurnal balik = hari ini (WIB), supaya periode lampau tidak berubah.
- Alasan wajib (min. 5 karakter). Setiap pembatalan masuk `pembatalan_keuangan`.
- Piutang batal = status BATAL. Hanya piutang manual, belum ada pembayaran.
- Transfer dibatalkan sebagai pasangan kedua kaki. Bila saldo akun tujuan jadi
  negatif (uangnya sudah terpakai), pembatalan ditolak.
- Dokumen sebelum tanggal saldo awal tidak bisa dibatalkan, karena Modal Awal
  sudah dibekukan.
- Seluruh pembatalan atomik: gagal di tengah berarti tidak ada yang tersimpan.
"""

import re
from contextlib import contextmanager
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.bengkel import PengeluaranBengkel
from app.models.jasa_angkut import JasaAngkutPartService
from app.models.karyawan import KasbonKaryawan
from app.models.keuangan import KasBank, PiutangUsaha
from app.models.mobil import MobilPartService
from app.models.pembatalan_filter import INCLUDE_DIBATALKAN
from app.models.pembatalan_keuangan import PembatalanKeuangan
from app.realtime import publish_realtime_event
from app.schemas.keuangan import KasBankCreate
from app.services.kas_bank_service import KasBankService
from app.services.reports.modal_service import ModalService
from app.utils.constants import (
    KasBankJenis,
    KasBankSource,
    KasBankType,
    PaymentStatus,
    PiutangSource,
    PiutangStatus,
)
from app.utils.helpers import get_jakarta_date, get_jakarta_now

ALASAN_MIN_LEN = 5
PREFIX_VOID = "[VOID]"
PREFIX_GRUP_TRANSFER = "TRF-"
SUMBER_PENGELUARAN = (KasBankSource.PENGELUARAN, KasBankSource.PRIVE)
SUMBER_PIUTANG_MANUAL = (PiutangSource.LAINNYA, PiutangSource.KASBON_KARYAWAN)
_POLA_TRANSFER = re.compile(r"^Transfer (ke|dari) (\w+): (.*)$", re.DOTALL)
_BATAL = {INCLUDE_DIBATALKAN: True}


class PembatalanService:
    def __init__(self, db: Session):
        self.db = db

    @contextmanager
    def _atomik(self):
        """Satu paket: semua jurnal dan status batal tersimpan, atau tidak sama sekali."""
        try:
            yield
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

    # ------------------------------------------------------------------ helpers

    @staticmethod
    def _validasi_alasan(alasan: Optional[str]) -> str:
        bersih = (alasan or "").strip()
        if len(bersih) < ALASAN_MIN_LEN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Alasan pembatalan wajib diisi minimal {ALASAN_MIN_LEN} karakter",
            )
        return bersih

    def _cek_setelah_saldo_awal(self, tanggal) -> None:
        anchor = ModalService(self.db)._saldo_awal_date()
        if anchor and tanggal < anchor:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Dokumen tanggal {tanggal} sebelum saldo awal ({anchor}) tidak bisa dibatalkan",
            )

    def _balik_kas(self, baris: List[KasBank], alasan: str, user_id: Optional[int]) -> List[str]:
        """Sembunyikan jurnal asli, buat jurnal balik, lalu cek saldo dan rantai saldo.

        Urutan penting: jurnal asli disembunyikan dulu supaya pengecekan saldo dan
        perhitungan rantai melihat keadaan sesudah pembatalan.
        """
        if not baris:
            return []
        waktu = get_jakarta_now().replace(tzinfo=None)
        hari_ini = get_jakarta_date()
        for kb in baris:
            kb.dibatalkan_at = waktu
        self.db.flush()

        nomor_jurnal: List[str] = []
        for kb in baris:
            tipe_balik = KasBankType.MASUK if kb.tipe == KasBankType.KELUAR else KasBankType.KELUAR
            jurnal = KasBankService(self.db).create(
                KasBankCreate(
                    tanggal=hari_ini,
                    jenis=kb.jenis,
                    tipe=tipe_balik,
                    nominal=kb.nominal,
                    sumber=kb.sumber,
                    metode_bayar=kb.metode_bayar,
                    referensi_id=kb.referensi_id,
                    nomor_referensi=kb.nomor_referensi,
                    keterangan=f"{PREFIX_VOID} Pembatalan {kb.nomor_transaksi}: {alasan}"[:255],
                    allow_negative=True,
                ),
                user_id,
                commit=False,
            )
            jurnal.dibatalkan_at = waktu
            nomor_jurnal.append(jurnal.nomor_transaksi)
        self.db.flush()

        for jenis in {kb.jenis for kb in baris}:
            saldo = KasBankService(self.db)._get_current_balance(jenis)
            if saldo < 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Pembatalan ditolak: saldo {jenis.value} menjadi negatif ({saldo}). Uang dari transaksi ini sudah terpakai",
                )
            self._rantai_ulang_saldo(jenis)
        return nomor_jurnal

    def _rantai_ulang_saldo(self, jenis: KasBankJenis) -> None:
        """Hitung ulang saldo_sebelum/sesudah baris yang masih terlihat, kronologis."""
        baris = (
            self.db.query(KasBank)
            .filter(KasBank.jenis == jenis)
            .order_by(KasBank.tanggal, KasBank.id)
            .all()
        )
        saldo_berjalan = 0
        for kb in baris:
            kb.calculate_saldo(saldo_berjalan)
            saldo_berjalan = kb.saldo_sesudah
        self.db.flush()

    def _catat_riwayat(
        self,
        jenis: str,
        nomor_dokumen: str,
        dokumen_id: Optional[int],
        ringkasan: str,
        nominal,
        alasan: str,
        kas_nomor: List[str],
        user_id: Optional[int],
    ) -> PembatalanKeuangan:
        riwayat = PembatalanKeuangan(
            jenis=jenis,
            nomor_dokumen=nomor_dokumen,
            dokumen_id=dokumen_id,
            ringkasan=ringkasan[:255],
            nominal=nominal,
            alasan=alasan,
            kas_nomor=", ".join(kas_nomor) if kas_nomor else None,
            dibatalkan_at=get_jakarta_now().replace(tzinfo=None),
            dibatalkan_by=user_id,
        )
        self.db.add(riwayat)
        return riwayat

    # ------------------------------------------------------------ pengeluaran

    def batalkan_pengeluaran(self, pengeluaran_id: int, alasan: str, user_id: Optional[int]) -> PembatalanKeuangan:
        alasan = self._validasi_alasan(alasan)
        pengeluaran = (
            self.db.query(PengeluaranBengkel)
            .execution_options(**_BATAL)
            .filter(PengeluaranBengkel.id == pengeluaran_id)
            .first()
        )
        if not pengeluaran:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pengeluaran tidak ditemukan")
        if pengeluaran.dibatalkan_at is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pengeluaran sudah dibatalkan")
        self._cek_setelah_saldo_awal(pengeluaran.tanggal)

        with self._atomik():
            baris_kas = (
                self.db.query(KasBank)
                .filter(
                    KasBank.referensi_id == pengeluaran.id,
                    KasBank.nomor_referensi == pengeluaran.nomor_transaksi,
                    KasBank.tipe == KasBankType.KELUAR,
                    KasBank.sumber.in_(SUMBER_PENGELUARAN),
                    ~KasBank.keterangan.like(f"{PREFIX_VOID}%"),
                )
                .all()
            )
            kas_nomor = self._balik_kas(baris_kas, alasan, user_id)

            waktu = get_jakarta_now().replace(tzinfo=None)
            pengeluaran.dibatalkan_at = waktu
            pengeluaran.dibatalkan_by = user_id
            pengeluaran.alasan_batal = alasan[:255]

            # Baris turunan (biaya part armada/mobil) ikut batal; tidak dihapus.
            catatan_turunan = f"Pengeluaran Bengkel: {pengeluaran.nomor_transaksi}"
            for model in (JasaAngkutPartService, MobilPartService):
                self.db.query(model).filter(
                    model.catatan.like(catatan_turunan),
                    model.dibatalkan_at.is_(None),
                ).update({model.dibatalkan_at: waktu}, synchronize_session=False)

            riwayat = self._catat_riwayat(
                jenis="PENGELUARAN",
                nomor_dokumen=pengeluaran.nomor_transaksi,
                dokumen_id=pengeluaran.id,
                ringkasan=f"{pengeluaran.kategori} - {pengeluaran.deskripsi}",
                nominal=pengeluaran.jumlah,
                alasan=alasan,
                kas_nomor=kas_nomor,
                user_id=user_id,
            )
        self._publish(riwayat)
        return riwayat

    # ------------------------------------------------------------------ piutang

    def batalkan_piutang(self, piutang_id: int, alasan: str, user_id: Optional[int]) -> PembatalanKeuangan:
        alasan = self._validasi_alasan(alasan)
        piutang = self.db.query(PiutangUsaha).filter(PiutangUsaha.id == piutang_id).first()
        if not piutang:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Piutang tidak ditemukan")
        if piutang.status == PiutangStatus.BATAL:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Piutang sudah dibatalkan")
        if piutang.is_internal or piutang.sumber not in SUMBER_PIUTANG_MANUAL:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Piutang dari transaksi unit dibatalkan lewat transaksinya",
            )
        if (piutang.total_dibayar or 0) > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Piutang sudah ada pembayaran. Batalkan pembayarannya dulu",
            )
        self._cek_setelah_saldo_awal(piutang.tanggal)

        with self._atomik():
            baris_kas = (
                self.db.query(KasBank)
                .filter(
                    KasBank.referensi_id == piutang.id,
                    KasBank.nomor_referensi == piutang.nomor_piutang,
                    KasBank.tipe == KasBankType.KELUAR,
                    ~KasBank.keterangan.like(f"{PREFIX_VOID}%"),
                )
                .all()
            )
            kas_nomor = self._balik_kas(baris_kas, alasan, user_id)

            piutang.status = PiutangStatus.BATAL
            riwayat = self._catat_riwayat(
                jenis="PIUTANG",
                nomor_dokumen=piutang.nomor_piutang,
                dokumen_id=piutang.id,
                ringkasan=f"Kasbon/piutang {piutang.nama_debitur}",
                nominal=piutang.nominal_piutang,
                alasan=alasan,
                kas_nomor=kas_nomor,
                user_id=user_id,
            )
        self._publish(riwayat)
        return riwayat

    # ----------------------------------------------------------------- transfer

    def _pasangan_transfer(self, kb: KasBank) -> List[KasBank]:
        """Kaki transfer yang sama dengan `kb`, yang belum dibatalkan. Kosong bila bukan transfer."""
        if kb.nomor_referensi and kb.nomor_referensi.startswith(PREFIX_GRUP_TRANSFER):
            return (
                self.db.query(KasBank)
                .filter(
                    KasBank.nomor_referensi == kb.nomor_referensi,
                    ~KasBank.keterangan.like(f"{PREFIX_VOID}%"),
                )
                .all()
            )
        if kb.nomor_referensi is not None:
            return []

        # Transfer lama (sebelum ada nomor grup): pasangkan dua baris yang teksnya
        # dibuat dari input yang sama, dengan tanggal dan nominal sama. Hanya bila
        # pasangannya tepat satu; kalau ambigu, tolak.
        cocok = _POLA_TRANSFER.match(kb.keterangan or "")
        if not cocok:
            return []
        arah, akun, teks = cocok.groups()
        try:
            akun_jenis = KasBankJenis(akun)
        except ValueError:
            return []
        if arah == "ke":
            dari, ke = kb.jenis, akun_jenis
            pasangan_tipe, pasangan_jenis = KasBankType.MASUK, ke
            pasangan_teks = f"Transfer dari {dari.value}: {teks}"
            kaki_kb_pertama = True
        else:
            dari, ke = akun_jenis, kb.jenis
            pasangan_tipe, pasangan_jenis = KasBankType.KELUAR, dari
            pasangan_teks = f"Transfer ke {ke.value}: {teks}"
            kaki_kb_pertama = False
        kandidat = (
            self.db.query(KasBank)
            .filter(
                KasBank.tipe == pasangan_tipe,
                KasBank.jenis == pasangan_jenis,
                KasBank.tanggal == kb.tanggal,
                KasBank.nominal == kb.nominal,
                KasBank.keterangan == pasangan_teks,
                KasBank.nomor_referensi.is_(None),
                KasBank.sumber == KasBankSource.LAINNYA,
                ~KasBank.keterangan.like(f"{PREFIX_VOID}%"),
            )
            .all()
        )
        if len(kandidat) != 1:
            return []
        return [kb, kandidat[0]] if kaki_kb_pertama else [kandidat[0], kb]

    def batalkan_transfer(self, kaki: List[KasBank], alasan: str, user_id: Optional[int]) -> PembatalanKeuangan:
        if not kaki:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pasangan transfer tidak ditemukan")
        self._cek_setelah_saldo_awal(kaki[0].tanggal)
        nomor_grup = kaki[0].nomor_referensi if (kaki[0].nomor_referensi or "").startswith(PREFIX_GRUP_TRANSFER) else None
        nominal = kaki[0].nominal
        ringkasan = f"Transfer {kaki[0].jenis.value} - {kaki[-1].jenis.value}"

        with self._atomik():
            kas_nomor = self._balik_kas(kaki, alasan, user_id)
            riwayat = self._catat_riwayat(
                jenis="TRANSFER",
                nomor_dokumen=nomor_grup or kaki[0].nomor_transaksi,
                dokumen_id=None,
                ringkasan=ringkasan,
                nominal=nominal,
                alasan=alasan,
                kas_nomor=kas_nomor,
                user_id=user_id,
            )
        self._publish(riwayat)
        return riwayat

    # ------------------------------------------------------------------ kasbon

    def batalkan_kasbon(self, kasbon_id: int, alasan: str, user_id: Optional[int]) -> PembatalanKeuangan:
        """Kasbon karyawan: hanya bila belum ada pembayaran. Piutangnya ikut batal."""
        alasan = self._validasi_alasan(alasan)
        kasbon = self.db.query(KasbonKaryawan).filter(KasbonKaryawan.id == kasbon_id).first()
        if not kasbon:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kasbon tidak ditemukan")
        if kasbon.status == PaymentStatus.BATAL:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kasbon sudah dibatalkan")
        if kasbon.status != PaymentStatus.BELUM_LUNAS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat membatalkan kasbon yang sudah memiliki riwayat pembayaran",
            )
        self._cek_setelah_saldo_awal(kasbon.tanggal)

        piutang_terkait = (
            self.db.query(PiutangUsaha)
            .filter(
                PiutangUsaha.nomor_referensi == kasbon.nomor_kasbon,
                PiutangUsaha.sumber == PiutangSource.KASBON_KARYAWAN,
            )
            .all()
        )
        if any((p.total_dibayar or 0) > 0 for p in piutang_terkait):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat membatalkan kasbon yang piutangnya sudah dibayar",
            )

        with self._atomik():
            baris_kas = (
                self.db.query(KasBank)
                .filter(
                    KasBank.referensi_id == kasbon.id,
                    KasBank.nomor_referensi == kasbon.nomor_kasbon,
                    KasBank.sumber == KasBankSource.KASBON,
                    KasBank.tipe == KasBankType.KELUAR,
                    ~KasBank.keterangan.like(f"{PREFIX_VOID}%"),
                )
                .all()
            )
            kas_nomor = self._balik_kas(baris_kas, alasan, user_id)

            for p in piutang_terkait:
                p.status = PiutangStatus.BATAL
            kasbon.status = PaymentStatus.BATAL

            riwayat = self._catat_riwayat(
                jenis="KASBON",
                nomor_dokumen=kasbon.nomor_kasbon,
                dokumen_id=kasbon.id,
                ringkasan=f"Kasbon karyawan #{kasbon.karyawan_id}",
                nominal=kasbon.nominal,
                alasan=alasan,
                kas_nomor=kas_nomor,
                user_id=user_id,
            )
        self._publish(riwayat)
        return riwayat

    # ------------------------------------------------------------- entry point

    def batalkan_dari_kas(self, kas_id: int, alasan: str, user_id: Optional[int]) -> PembatalanKeuangan:
        """Batalkan dari satu baris kas: sistem mencari dokumen asalnya."""
        alasan = self._validasi_alasan(alasan)
        kb = self.db.query(KasBank).filter(KasBank.id == kas_id).first()
        if not kb:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaksi kas tidak ditemukan")
        if (kb.keterangan or "").startswith(PREFIX_VOID):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Baris ini adalah jurnal pembatalan, bukan transaksi asal",
            )

        if kb.referensi_id is not None and kb.nomor_referensi and kb.sumber in SUMBER_PENGELUARAN:
            pengeluaran = (
                self.db.query(PengeluaranBengkel.id)
                .execution_options(**_BATAL)
                .filter(
                    PengeluaranBengkel.id == kb.referensi_id,
                    PengeluaranBengkel.nomor_transaksi == kb.nomor_referensi,
                )
                .first()
            )
            if pengeluaran:
                return self.batalkan_pengeluaran(pengeluaran.id, alasan, user_id)

        if kb.referensi_id is not None and kb.nomor_referensi:
            piutang = (
                self.db.query(PiutangUsaha.id)
                .filter(
                    PiutangUsaha.id == kb.referensi_id,
                    PiutangUsaha.nomor_piutang == kb.nomor_referensi,
                )
                .first()
            )
            if piutang:
                return self.batalkan_piutang(piutang.id, alasan, user_id)

        if kb.referensi_id is not None and kb.nomor_referensi and kb.sumber == KasBankSource.KASBON:
            kasbon = (
                self.db.query(KasbonKaryawan.id)
                .filter(
                    KasbonKaryawan.id == kb.referensi_id,
                    KasbonKaryawan.nomor_kasbon == kb.nomor_referensi,
                )
                .first()
            )
            if kasbon:
                return self.batalkan_kasbon(kasbon.id, alasan, user_id)

        kaki = self._pasangan_transfer(kb)
        if kaki:
            return self.batalkan_transfer(kaki, alasan, user_id)

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transaksi ini tidak bisa dibatalkan dari sini. Batalkan lewat menu asalnya",
        )

    # ---------------------------------------------------------------- riwayat

    def list_riwayat(self, jenis: Optional[str] = None, limit: int = 100) -> List[PembatalanKeuangan]:
        q = self.db.query(PembatalanKeuangan)
        if jenis:
            q = q.filter(PembatalanKeuangan.jenis == jenis.upper())
        return q.order_by(PembatalanKeuangan.dibatalkan_at.desc(), PembatalanKeuangan.id.desc()).limit(min(max(limit, 1), 500)).all()

    def _publish(self, riwayat: PembatalanKeuangan) -> None:
        publish_realtime_event(
            event="finance.kas.updated",
            scope="finance",
            entity="pembatalan",
            action="cancelled",
            entity_id=riwayat.id,
            data={"jenis": riwayat.jenis, "nomor": riwayat.nomor_dokumen, "nominal": float(riwayat.nominal)},
        )
