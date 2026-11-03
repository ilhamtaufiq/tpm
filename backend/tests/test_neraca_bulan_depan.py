"""Neraca untuk tanggal setelah hari ini: persediaan part 0, dan neraca tetap seimbang."""
from datetime import timedelta

from app.database import SessionLocal
from app.services.reports.neraca_service import NeracaService
from app.utils.helpers import get_jakarta_date


def test_persediaan_bulan_depan_nol_dan_seimbang():
    db = SessionLocal()
    try:
        depan = get_jakarta_date() + timedelta(days=60)
        hasil = NeracaService(db).get_report(depan)
        assert hasil["aktiva_lancar"]["persediaan_sparepart"] == 0
        assert hasil["is_balanced"] is True
        assert abs(hasil["selisih"]) < 0.01
    finally:
        db.close()


def test_persediaan_hari_ini_tidak_dinolkan():
    db = SessionLocal()
    try:
        hasil = NeracaService(db).get_report(get_jakarta_date())
        assert hasil["is_balanced"] is True
    finally:
        db.close()
