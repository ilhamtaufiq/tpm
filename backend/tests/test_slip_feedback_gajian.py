"""Feedback user: slip bisa dibuat kapan saja, gajian Sabtu dibuat hari Jumat (periode berjalan),
dan karyawan gajian Kamis memakai periode Kamis s/d Rabu (lintas minggu)."""
from datetime import date
from decimal import Decimal

from app.database import SessionLocal
from app.models.karyawan import Absensi, Karyawan, EmployeeStatus, SlipGaji
from app.utils.constants import AttendanceStatus
from app.services.slip_gaji_service import SlipGajiService

KODE_SABTU = "UJI-FB-SABTU"
KODE_KAMIS = "UJI-FB-KAMIS"
# Hari ini = Jumat 20 Nov 2026: periode Sabtu (16–21 Nov) masih berjalan; periode Kamis (12–18 Nov) sudah selesai.
SABTU_DARI, SABTU_SAMPAI = date(2026, 11, 16), date(2026, 11, 21)
KAMIS_DARI, KAMIS_SAMPAI = date(2026, 11, 12), date(2026, 11, 18)


def _bersihkan(db):
    ids = [k.id for k in db.query(Karyawan).filter(Karyawan.kode.in_([KODE_SABTU, KODE_KAMIS])).all()]
    if ids:
        db.query(SlipGaji).filter(SlipGaji.karyawan_id.in_(ids)).delete(synchronize_session=False)
        db.query(Absensi).filter(Absensi.karyawan_id.in_(ids)).delete(synchronize_session=False)
        db.query(Karyawan).filter(Karyawan.id.in_(ids)).delete(synchronize_session=False)
    db.commit()


def _buat_karyawan(db, kode, nama, hari_gajian):
    kar = Karyawan(
        kode=kode, nama=nama, jabatan="UJI", tanggal_bergabung=date(2026, 1, 1),
        gaji_pokok=Decimal("1500000"), status=EmployeeStatus.AKTIF, hari_gajian=hari_gajian,
    )
    db.add(kar)
    db.commit()
    db.refresh(kar)
    return kar


def test_feedback_slip_gajian_sabtu_dibuat_hari_jumat_dan_kamis_lintas_minggu():
    db = SessionLocal()
    _bersihkan(db)
    try:
        sabtu = _buat_karyawan(db, KODE_SABTU, "UJI FB SABTU", "SABTU")
        kamis = _buat_karyawan(db, KODE_KAMIS, "UJI FB KAMIS", "KAMIS")
        # Absensi yang sudah ada: Senin–Kamis minggu ini untuk Sabtu; Kamis–Rabu untuk Kamis.
        for d in (16, 17, 18, 19):
            db.add(Absensi(karyawan_id=sabtu.id, tanggal=date(2026, 11, d), status=AttendanceStatus.HADIR))
        for d in (12, 13, 14, 15, 16, 17, 18):
            db.add(Absensi(karyawan_id=kamis.id, tanggal=date(2026, 11, d), status=AttendanceStatus.HADIR))
        db.commit()
        svc = SlipGajiService(db)

        # 1) Gajian Sabtu dibuat hari Jumat: periode belum selesai, tetap boleh diproses.
        pv = svc.get_preview_by_range(SABTU_DARI, SABTU_SAMPAI)
        item_sabtu = next(i for i in pv["items"] if i["karyawan_id"] == sabtu.id)
        assert item_sabtu["hari_gajian"] == "SABTU"
        hasil = svc.create_bulk_by_range(
            SABTU_DARI, SABTU_SAMPAI, SABTU_DARI.isocalendar()[1], SABTU_DARI.isocalendar()[0],
            [{"karyawan_id": sabtu.id, "jumlah_hadir": item_sabtu["jumlah_hadir"], "potongan_kasbon": 0, "uang_lembur": 0}],
            None,
        )
        assert hasil["created"] == 1, hasil
        slip_sabtu = db.query(SlipGaji).filter(SlipGaji.karyawan_id == sabtu.id).one()
        assert slip_sabtu.tanggal_mulai == SABTU_DARI and slip_sabtu.tanggal_akhir == SABTU_SAMPAI

        # 2) Gajian Kamis: periode Kamis s/d Rabu (lintas minggu, sudah selesai), dibuat dengan rentangnya.
        pk = svc.get_preview_by_range(KAMIS_DARI, KAMIS_SAMPAI)
        item_kamis = next(i for i in pk["items"] if i["karyawan_id"] == kamis.id)
        assert item_kamis["hari_gajian"] == "KAMIS"
        hasil_k = svc.create_bulk_by_range(
            KAMIS_DARI, KAMIS_SAMPAI, KAMIS_DARI.isocalendar()[1], KAMIS_DARI.isocalendar()[0],
            [{"karyawan_id": kamis.id, "jumlah_hadir": item_kamis["jumlah_hadir"], "potongan_kasbon": 0, "uang_lembur": 0}],
            None,
        )
        assert hasil_k["created"] == 1, hasil_k
        slip_kamis = db.query(SlipGaji).filter(SlipGaji.karyawan_id == kamis.id).one()
        assert slip_kamis.tanggal_mulai == KAMIS_DARI and slip_kamis.tanggal_akhir == KAMIS_SAMPAI
        assert (KAMIS_DARI.weekday(), KAMIS_SAMPAI.weekday()) == (3, 2)  # Kamis s/d Rabu
    finally:
        _bersihkan(db)
        db.close()
