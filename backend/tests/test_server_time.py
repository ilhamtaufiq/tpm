"""Endpoint jam server: tanggal harus WIB, bukan tanggal zona mesin."""
from app.api.v1.system import server_time
from app.utils.helpers import get_jakarta_date


def test_server_time_mengembalikan_tanggal_wib():
    hasil = server_time()
    assert hasil["zona"] == "Asia/Jakarta"
    assert hasil["tanggal"] == get_jakarta_date().isoformat()
    assert isinstance(hasil["epoch_ms"], int) and hasil["epoch_ms"] > 0
