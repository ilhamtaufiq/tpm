"""Regresi: menghapus biaya lainnya per mobil juga menghapus baris ledger (PengeluaranBengkel) dan kas-nya,
supaya neraca tidak lagi menghitung biaya yang sudah dihapus."""
from datetime import date
from decimal import Decimal

import pytest

from app.database import SessionLocal
from app.models.bengkel import PengeluaranBengkel
from app.models.keuangan import KasBank
from app.models.mobil import Mobil, MobilBiayaLainnya
from app.services.mobil_service import MobilService
from app.utils.constants import KasBankJenis, PaymentMethod


def test_hapus_biaya_lainnya_ikut_hapus_ledger_dan_kas():
    db = SessionLocal()
    biaya_id = None
    nomor = None
    try:
        mobil = db.query(Mobil).filter(Mobil.deleted_at.is_(None)).first()
        if mobil is None:
            pytest.skip("tidak ada mobil di DB ini")
        svc = MobilService(db)
        pengeluaran = svc.add_biaya(
            mobil.id, date.today(), "Biaya Lainnya", "UJI HAPUS BIAYA", Decimal("50000"),
            payments=[{"metode": PaymentMethod.TUNAI, "nominal": Decimal("50000"), "kas_jenis": KasBankJenis.KAS_UNIT_MOBIL}],
        )
        nomor = pengeluaran.nomor_transaksi
        baris = db.query(MobilBiayaLainnya).filter(
            MobilBiayaLainnya.catatan == f"ID Pengeluaran: {pengeluaran.id}"
        ).one()
        biaya_id = baris.id
        assert db.query(PengeluaranBengkel).filter(PengeluaranBengkel.nomor_transaksi == nomor).count() == 1
        assert db.query(KasBank).filter(KasBank.nomor_referensi == nomor).count() >= 1

        svc.delete_biaya(biaya_id)
        db.expire_all()

        assert db.get(MobilBiayaLainnya, biaya_id) is None
        assert db.query(PengeluaranBengkel).filter(PengeluaranBengkel.nomor_transaksi == nomor).count() == 0
        assert db.query(KasBank).filter(KasBank.nomor_referensi == nomor).count() == 0
    finally:
        if nomor:
            db.query(KasBank).filter(KasBank.nomor_referensi == nomor).delete(synchronize_session=False)
            db.query(PengeluaranBengkel).filter(PengeluaranBengkel.nomor_transaksi == nomor).delete(synchronize_session=False)
        if biaya_id:
            db.query(MobilBiayaLainnya).filter(MobilBiayaLainnya.id == biaya_id).delete(synchronize_session=False)
        db.commit()
        db.close()
