"""Slip gaji: periode mengikuti rentang tanggal, bukan nomor minggu."""
from datetime import date
from decimal import Decimal

import pytest

from app.database import SessionLocal
from app.models.karyawan import Karyawan, SlipGaji
from app.services.slip_gaji_service import SlipGajiService
from app.utils.constants import EmployeeStatus, PaymentStatus

KODE_UJI = "UJI-SLIP-TGL"


def _karyawan(db):
    k = db.query(Karyawan).filter(Karyawan.kode == KODE_UJI).first()
    if k is None:
        k = Karyawan(nama="Uji Slip Tanggal", kode=KODE_UJI, jabatan="UJI", tanggal_bergabung=date(2026, 1, 1), gaji_pokok=Decimal("600000"),
                     status=EmployeeStatus.AKTIF)
        db.add(k)
        db.commit()
    return k


def _slip(db, k, mulai, akhir, nomor):
    minggu = mulai.isocalendar()[1]
    tahun = mulai.isocalendar()[0]
    row = SlipGaji(
        nomor_slip=nomor, karyawan_id=k.id, periode_tahun=tahun, periode_minggu=minggu,
        jumlah_hadir=Decimal("1"), gaji_pokok=Decimal("100000"), potongan_kasbon=Decimal("0"),
        gaji_bersih=Decimal("100000"), uang_lembur=Decimal("0"), status=PaymentStatus.LUNAS,
        tanggal_mulai=mulai, tanggal_akhir=akhir,
    )
    db.add(row)
    db.commit()
    return row


def test_rentang_berbeda_dalam_minggu_iso_sama_boleh_dibuat():
    db = SessionLocal()
    slips = []
    try:
        k = _karyawan(db)
        # 16–19 dan 21–26 Nov 2026 sama-sama minggu ISO 47 (dan 21 Nov ada di 16–21)
        slips.append(_slip(db, k, date(2026, 11, 16), date(2026, 11, 19), "UJI-TGL-A"))
        svc = SlipGajiService(db)
        # Rentang 22–26 tidak tumpang tindih dengan 16–19: tidak boleh diblokir
        assert svc._slip_bentrok(k.id, date(2026, 11, 22), date(2026, 11, 26), 47, 2026) is None
    finally:
        for s in slips:
            db.delete(s)
        db.commit()
        db.close()


def test_rentang_yang_tumpang_tindih_tetap_diblokir():
    db = SessionLocal()
    slips = []
    try:
        k = _karyawan(db)
        slips.append(_slip(db, k, date(2026, 11, 16), date(2026, 11, 21), "UJI-TGL-B"))
        svc = SlipGajiService(db)
        # 21 Nov sudah dibayar di slip 16–21: periode 21–26 harus diblokir
        assert svc._slip_bentrok(k.id, date(2026, 11, 21), date(2026, 11, 26), 47, 2026) is not None
    finally:
        for s in slips:
            db.delete(s)
        db.commit()
        db.close()


def test_dua_slip_minggu_sama_boleh_disimpan_di_database():
    db = SessionLocal()
    slips = []
    try:
        k = _karyawan(db)
        slips.append(_slip(db, k, date(2026, 11, 16), date(2026, 11, 19), "UJI-TGL-C"))
        slips.append(_slip(db, k, date(2026, 11, 22), date(2026, 11, 26), "UJI-TGL-D"))  # minggu 47 & 48
        slips.append(_slip(db, k, date(2026, 11, 23), date(2026, 11, 29), "UJI-TGL-E"))  # minggu 47 juga
    finally:
        for s in slips:
            db.delete(s)
        db.commit()
        db.close()
