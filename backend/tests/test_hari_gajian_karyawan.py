"""Hari gajian per karyawan: SABTU (default) atau KAMIS, ikut ke preview slip gaji."""
from datetime import date
from decimal import Decimal

from app.database import SessionLocal
from app.models.karyawan import Karyawan
from app.schemas.karyawan import KaryawanCreate
from app.services.karyawan_service import KaryawanService
from app.services.slip_gaji_service import SlipGajiService

NAMA = "UJI HARI GAJIAN KAMIS"


def test_karyawan_kamis_muncul_dengan_hari_gajian_di_preview():
    db = SessionLocal()
    try:
        db.query(Karyawan).filter(Karyawan.nama == NAMA).delete(synchronize_session=False)
        db.commit()
        karyawan = KaryawanService(db).create(KaryawanCreate(
            nama=NAMA, jabatan="Uji", gaji_pokok=Decimal("1000000"),
            tanggal_bergabung=date(2026, 1, 1), hari_gajian="KAMIS",
        ))
        assert karyawan.hari_gajian == "KAMIS"
        preview = SlipGajiService(db).get_preview_by_range(date(2026, 11, 12), date(2026, 11, 18))
        item = next(i for i in preview["items"] if i["karyawan_id"] == karyawan.id)
        assert item["hari_gajian"] == "KAMIS"
    finally:
        db.query(Karyawan).filter(Karyawan.nama == NAMA).delete(synchronize_session=False)
        db.commit()
        db.close()


def test_karyawan_default_hari_gajian_sabtu():
    db = SessionLocal()
    try:
        db.query(Karyawan).filter(Karyawan.nama == NAMA).delete(synchronize_session=False)
        db.commit()
        karyawan = KaryawanService(db).create(KaryawanCreate(
            nama=NAMA, jabatan="Uji", gaji_pokok=Decimal("1000000"), tanggal_bergabung=date(2026, 1, 1),
        ))
        assert karyawan.hari_gajian == "SABTU"
    finally:
        db.query(Karyawan).filter(Karyawan.nama == NAMA).delete(synchronize_session=False)
        db.commit()
        db.close()
