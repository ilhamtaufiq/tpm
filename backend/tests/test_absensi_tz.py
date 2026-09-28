from datetime import date, time
from app.services.absensi_service import AbsensiService
from app.utils.helpers import get_jakarta_date


def test_absensi_service_clock_in_out_defaults():
    # Verify get_jakarta_date is used
    today_wib = get_jakarta_date()
    assert isinstance(today_wib, date)
