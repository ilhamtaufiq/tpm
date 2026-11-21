"""Skrip pembersih sisa biaya mobil: mendeteksi ledger yang biayanya sudah hilang, tidak menyentuh yang lengkap."""
import importlib.util
import os
from datetime import date
from decimal import Decimal

import pytest

from app.database import SessionLocal
from app.models.bengkel import PengeluaranBengkel
from app.models.keuangan import KasBank
from app.models.mobil import Mobil, MobilBiayaLainnya
from app.services.mobil_service import MobilService
from app.utils.constants import KasBankJenis, PaymentMethod

SKRIP = os.path.join(os.path.dirname(__file__), "..", "scripts", "bersihkan_biaya_mobil_yatim.py")


def _muat_skrip():
    spec = importlib.util.spec_from_file_location("bersihkan_yatim", SKRIP)
    modul = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modul)
    return modul


def _buat_biaya(db, mobil):
    pb = MobilService(db).add_biaya(
        mobil.id, date.today(), "Biaya Lainnya", "UJI YATIM", Decimal("30000"),
        payments=[{"metode": PaymentMethod.TUNAI, "nominal": Decimal("30000"), "kas_jenis": KasBankJenis.KAS_UNIT_MOBIL}],
    )
    return pb


def test_skrip_mendeteksi_sisa_dan_mengabaikan_biaya_lengkap():
    db = SessionLocal()
    nomor_yatim = nomor_lengkap = None
    try:
        mobil = db.query(Mobil).filter(Mobil.deleted_at.is_(None)).first()
        if mobil is None:
            pytest.skip("tidak ada mobil di DB ini")
        yatim = _buat_biaya(db, mobil)
        lengkap = _buat_biaya(db, mobil)
        nomor_yatim, nomor_lengkap = yatim.nomor_transaksi, lengkap.nomor_transaksi
        # Simulasi bug lama: baris mobil_biaya_lainnya terhapus, ledger dan kas tertinggal.
        db.query(MobilBiayaLainnya).filter(MobilBiayaLainnya.catatan == f"ID Pengeluaran: {yatim.id}").delete(synchronize_session=False)
        db.commit()

        skrip = _muat_skrip()
        nomor_kandidat = {pb.nomor_transaksi for pb, _ in skrip.cari_kandidat(db)}
        assert nomor_yatim in nomor_kandidat
        assert nomor_lengkap not in nomor_kandidat
        kas_yatim = next(kas for pb, kas in skrip.cari_kandidat(db) if pb.nomor_transaksi == nomor_yatim)
        assert len(kas_yatim) >= 1
    finally:
        for nomor in (nomor_yatim, nomor_lengkap):
            if nomor:
                db.query(KasBank).filter(KasBank.nomor_referensi == nomor).delete(synchronize_session=False)
                db.query(PengeluaranBengkel).filter(PengeluaranBengkel.nomor_transaksi == nomor).delete(synchronize_session=False)
        db.query(MobilBiayaLainnya).filter(MobilBiayaLainnya.catatan.like("ID Pengeluaran:%"), MobilBiayaLainnya.kategori == "Biaya Lainnya", MobilBiayaLainnya.deskripsi == "UJI YATIM").delete(synchronize_session=False)
        db.commit()
        db.close()
