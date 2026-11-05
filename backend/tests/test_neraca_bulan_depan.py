"""Neraca untuk tanggal setelah hari ini: persediaan part 0, dan neraca tetap seimbang."""
from datetime import date, timedelta

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


def test_bulan_berjalan_tidak_dinolkan():
    """Layar mengirim akhir bulan. Bulan yang sedang berjalan harus tetap punya persediaan."""
    import calendar
    from app.database import SessionLocal as _SL
    hari_ini = get_jakarta_date()
    akhir_bulan = date(hari_ini.year, hari_ini.month, calendar.monthrange(hari_ini.year, hari_ini.month)[1])
    db = _SL()
    try:
        ref = NeracaService(db).get_report(akhir_bulan)
        hari = NeracaService(db).get_report(hari_ini)
        assert ref["aktiva_lancar"]["persediaan_sparepart"] == hari["aktiva_lancar"]["persediaan_sparepart"]
        assert ref["is_balanced"] is True
    finally:
        db.close()
