"""Dashboard memakai beban gaji akrual (sama dengan Laba Rugi), bukan kas bersih."""
from datetime import date
from decimal import Decimal

from app.api.v1.dashboard import _beban_gaji
from app.database.connection import SessionLocal
from app.models.karyawan import Absensi, Karyawan
from app.services.slip_gaji_service import SlipGajiService
from app.utils.constants import AttendanceStatus, EmployeeStatus

KODE = "DSH-UJI-GAJI"


def test_beban_gaji_pakai_akrual_bukan_kas_bersih():
    db = SessionLocal()
    kar = None
    try:
        kar = Karyawan(kode=KODE, nama="Uji Dashboard Gaji", jabatan="UJI",
                       tanggal_bergabung=date(2026, 1, 1), gaji_pokok=Decimal("600000"),
                       status=EmployeeStatus.AKTIF)
        db.add(kar)
        db.flush()
        db.add(Absensi(karyawan_id=kar.id, tanggal=date(2026, 10, 12), status=AttendanceStatus.HADIR))
        db.add(Absensi(karyawan_id=kar.id, tanggal=date(2026, 10, 13), status=AttendanceStatus.HADIR))
        db.commit()

        ringkasan = SlipGajiService(db).get_summary_by_date_range(date(2026, 10, 12), date(2026, 10, 13))
        # Belum ada slip cair: beban = akrual 2 hari (2 x 100.000), kas bersih = 0.
        assert ringkasan["total"] == 0.0
        assert _beban_gaji(ringkasan) == 200000.0
    finally:
        db.rollback()
        if kar is not None:
            db.query(Absensi).filter(Absensi.karyawan_id == kar.id).delete(synchronize_session=False)
            db.query(Karyawan).filter(Karyawan.kode == KODE).delete(synchronize_session=False)
            db.commit()
        db.close()
