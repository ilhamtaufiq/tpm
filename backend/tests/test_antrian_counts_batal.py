"""Chip 'Semua' pengerjaan di Antrian bengkel harus sama dengan jumlah baris yang tampil.

Filter ALL di list tidak menampilkan BATAL, jadi hitungan chip 'Semua' juga tidak boleh menghitungnya.
Data uji memakai tanggal dan prefix khusus, dan hanya menghapus barisnya sendiri.
"""
from datetime import date
from decimal import Decimal

import pytest

from app.database import SessionLocal
from app.models.bengkel import TransaksiPenjualanBengkel
from app.services.transaksi_bengkel_service import TransaksiBengkelService

TANGGAL = date(2002, 3, 4)
PREFIX = "TEST-CNTBATAL-"
SEARCH = "TEST-CNTBATAL"


def _baris(nomor, status_bayar, status_pengerjaan, dibayar="0"):
    total = Decimal("100000")
    return TransaksiPenjualanBengkel(
        nomor_transaksi=f"{PREFIX}{nomor}",
        tanggal=TANGGAL,
        kategori="umum",
        total_parts=Decimal("0"),
        total_jasa=total,
        subtotal=total,
        diskon=Decimal("0"),
        grand_total=total,
        hpp_parts=Decimal("0"),
        laba_kotor=total,
        jumlah_bayar=Decimal(dibayar),
        kembalian=Decimal("0"),
        status_pengerjaan=status_pengerjaan,
        status_bayar=status_bayar,
    )


def _hapus(db):
    db.query(TransaksiPenjualanBengkel).filter(
        TransaksiPenjualanBengkel.nomor_transaksi.like(f"{PREFIX}%")
    ).delete(synchronize_session=False)


@pytest.fixture
def data():
    db = SessionLocal()
    _hapus(db)
    db.add_all([
        _baris("BATAL", "BATAL", "BATAL"),
        _baris("ANTRE", "BELUM_LUNAS", "ANTRE"),
    ])
    db.commit()
    yield db
    db.rollback()
    _hapus(db)
    db.commit()
    db.close()


def _list(db, **kw):
    return TransaksiBengkelService(db).get_list(
        skip=0, limit=100, tanggal_dari=TANGGAL, tanggal_sampai=TANGGAL, **kw
    )


@pytest.mark.parametrize("kw", [
    {},
    {"search": SEARCH},
    {"pembayaran": "ALL"},
])
def test_chip_semua_sama_dengan_jumlah_baris_list(data, kw):
    hasil = _list(data, status_pengerjaan="ALL", **kw)
    assert hasil["counts"]["work"]["total"] == hasil["total"] == len(hasil["data"]) == 1
    assert all(t.status_pengerjaan != "BATAL" for t in hasil["data"])


def test_chip_batal_tetap_menghitung_baris_batal(data):
    hasil = _list(data, status_pengerjaan="ALL")
    assert hasil["counts"]["work"]["batal"] == 1
    assert hasil["counts"]["work"]["total"] == hasil["counts"]["work"]["antre"] + hasil["counts"]["work"]["proses"] + hasil["counts"]["work"]["selesai"]


def test_payment_total_tetap_menghitung_batal(data):
    hasil = _list(data, status_pengerjaan="ALL")
    assert hasil["counts"]["payment"]["total"] == 2
