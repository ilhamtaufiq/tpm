"""Akrual gaji dari absensi: beban & hutang gaji diakui saat absensi diisi,
slip yang dicairkan mengurangi hutang gaji (tidak jadi beban lagi).

Pakai karyawan & tanggal uji sendiri (periode >= GAJI_AKRUAL_MULAI) agar tidak
bergantung data produksi.
"""
from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.database.connection import SessionLocal
from app.models.karyawan import Absensi, Karyawan, SlipGaji
from app.models.keuangan import KasBank
from app.schemas.karyawan import SlipGajiCreate, SlipGajiUpdate, AbsensiUpdate
from app.services.absensi_service import AbsensiService
from app.services.gaji_akrual_service import (
    GAJI_AKRUAL_MULAI,
    akrual_gaji_periode,
    hutang_gaji_asof,
)
from app.services.kas_bank_integration import _resolve_kas_jenis, create_kas_entry
from app.services.reports.neraca_service import NeracaService
from app.services.slip_gaji_service import SlipGajiService, get_week_dates
from app.utils.constants import (
    AttendanceStatus,
    EmployeeStatus,
    KasBankSource,
    KasBankType,
    PaymentMethod,
)

KODE = "GJI-UJI-AKRUAL"
SENIN = date(2026, 10, 12)
SELASA = date(2026, 10, 13)
RABU = date(2026, 10, 14)
SABTU = date(2026, 10, 17)
GAJI = Decimal("600000")  # harian 100.000
SEED_KET = "SEED UJI AKRUAL GAJI"


def _bersihkan(db):
    kar = db.query(Karyawan).filter(Karyawan.kode == KODE).first()
    if kar is not None:
        slips = db.query(SlipGaji).filter(SlipGaji.karyawan_id == kar.id).all()
        for s in slips:
            db.query(KasBank).filter(KasBank.nomor_referensi == s.nomor_slip).delete(synchronize_session=False)
            db.delete(s)
        db.query(Absensi).filter(Absensi.karyawan_id == kar.id).delete(synchronize_session=False)
        db.delete(kar)
    db.query(KasBank).filter(KasBank.keterangan == SEED_KET).delete(synchronize_session=False)
    db.commit()


@pytest.fixture
def ctx():
    db = SessionLocal()
    _bersihkan(db)
    kar = Karyawan(
        kode=KODE, nama="Karyawan Uji Akrual", jabatan="UJI",
        tanggal_bergabung=date(2026, 1, 1), gaji_pokok=GAJI, status=EmployeeStatus.AKTIF,
    )
    db.add(kar)
    db.commit()
    db.refresh(kar)
    try:
        yield db, kar
    finally:
        db.rollback()
        _bersihkan(db)
        db.close()


def _absen(db, kar, tgl, st):
    db.add(Absensi(karyawan_id=kar.id, tanggal=tgl, status=st))
    db.commit()


def test_absensi_langsung_jadi_beban_dan_hutang_gaji(ctx):
    db, kar = ctx
    _absen(db, kar, SENIN, AttendanceStatus.HADIR)
    _absen(db, kar, SELASA, AttendanceStatus.HADIR)
    _absen(db, kar, RABU, AttendanceStatus.SETENGAH_HARI)
    _absen(db, kar, date(2026, 10, 15), AttendanceStatus.IZIN)  # tidak diakui

    assert akrual_gaji_periode(db, SENIN, RABU, kar.id) == Decimal("250000")
    assert hutang_gaji_asof(db, RABU) >= Decimal("250000")
    neraca = NeracaService(db).get_report(RABU)
    assert neraca["hutang"]["hutang_gaji"] >= 250000
    assert neraca["is_balanced"] is True


def test_slip_cair_mengurangi_hutang_bukan_beban(ctx):
    db, kar = ctx
    tgl_mulai, tgl_akhir = get_week_dates(2026, 41)
    assert tgl_mulai == SENIN and tgl_akhir == SABTU
    _absen(db, kar, SENIN, AttendanceStatus.HADIR)
    _absen(db, kar, SELASA, AttendanceStatus.HADIR)
    _absen(db, kar, RABU, AttendanceStatus.SETENGAH_HARI)
    hutang_sebelum = hutang_gaji_asof(db, SABTU)

    svc = SlipGajiService(db)
    slip = svc.create(SlipGajiCreate(karyawan_id=kar.id, periode_minggu=41, periode_tahun=2026))
    assert slip.gaji_pokok == Decimal("250000")
    assert slip.jumlah_hadir == Decimal("2.5")

    # Kas harus cukup untuk pencairan (guard saldo KELUAR).
    jenis = _resolve_kas_jenis(None, PaymentMethod.TUNAI, KasBankSource.GAJI)
    create_kas_entry(
        db=db, tanggal=date.today(), tipe=KasBankType.MASUK, nominal=Decimal("1000000"),
        sumber=KasBankSource.MODAL, metode_bayar=PaymentMethod.TUNAI, referensi_id=None,
        nomor_referensi=None, keterangan=SEED_KET, kas_jenis=jenis, commit=True,
    )
    svc.process_payment(slip.id, SlipGajiUpdate(metode_bayar=PaymentMethod.TUNAI), user_id=None)

    assert hutang_gaji_asof(db, SABTU) == hutang_sebelum - Decimal("250000")
    # Beban gaji periode slip sudah diakui di absensi: tidak dihitung lagi saat cair.
    ringkasan = svc.get_summary_by_date_range(SENIN, SABTU)
    assert ringkasan["total_gaji_pokok"] == 0.0
    assert ringkasan["total_gaji_pokok_akrual"] == 250000.0
    neraca = NeracaService(db).get_report(SABTU)
    assert neraca["is_balanced"] is True


def test_override_jumlah_hadir_ditolak_dan_absensi_terkunci(ctx):
    db, kar = ctx
    _absen(db, kar, SENIN, AttendanceStatus.HADIR)
    svc = SlipGajiService(db)
    with pytest.raises(HTTPException) as salah:
        svc.create_bulk_by_range(
            SENIN, SABTU, 41, 2026,
            items=[{"karyawan_id": kar.id, "jumlah_hadir": 3}],
        )
    assert salah.value.status_code == 400

    svc.create(SlipGajiCreate(karyawan_id=kar.id, periode_minggu=41, periode_tahun=2026))
    absensi_svc = AbsensiService(db)
    absen = db.query(Absensi).filter(Absensi.karyawan_id == kar.id).one()
    with pytest.raises(HTTPException) as kunci:
        absensi_svc.delete(absen.id)
    assert kunci.value.status_code == 400
    with pytest.raises(HTTPException):
        absensi_svc.update(absen.id, AbsensiUpdate(status=AttendanceStatus.ALPHA))
    db.rollback()


def test_periode_sebelum_cutoff_tidak_diakui(ctx):
    db, kar = ctx
    sebelum = date(2026, 10, 5)
    assert sebelum < GAJI_AKRUAL_MULAI
    _absen(db, kar, sebelum, AttendanceStatus.HADIR)
    assert akrual_gaji_periode(db, sebelum, sebelum, kar.id) == Decimal("0")


def test_slip_ganda_dilewati_dan_tidak_muncul_di_pending(ctx):
    """Satu slip per karyawan per minggu, dan rentang tanggal tidak boleh tumpang tindih.
    Yang dilewati harus dilaporkan (bukan diam-diam), dan tidak lagi pending."""
    db, kar = ctx
    for d in (12, 13, 14, 15, 16, 17):
        _absen(db, kar, date(2026, 10, d), AttendanceStatus.HADIR)
    svc = SlipGajiService(db)
    items = [{"karyawan_id": kar.id, "jumlah_hadir": 6, "potongan_kasbon": 0, "uang_lembur": 0}]

    awal = svc.create_bulk_by_range(SENIN, SABTU, 42, 2026, items, None)
    assert awal["created"] == 1 and awal["skipped"] == 0

    ulang = svc.create_bulk_by_range(SENIN, SABTU, 42, 2026, items, None)
    assert ulang["created"] == 0 and ulang["skipped"] == 1
    assert "sudah ada slip" in ulang["skipped_detail"][0]

    # Rentang minggu berikutnya yang menyentuh tanggal 17 juga bentrok (akrual tidak dibayar dua kali).
    tumpang = svc.create_bulk_by_range(date(2026, 10, 17), date(2026, 10, 23), 43, 2026, items, None)
    assert tumpang["created"] == 0 and tumpang["skipped"] == 1

    pending = [i for i in svc.get_preview_by_range(SENIN, SABTU)["items"] if i["karyawan_id"] == kar.id]
    assert pending == []
