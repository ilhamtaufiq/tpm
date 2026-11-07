"""Filter Antrian bengkel di server: status pengerjaan, pembayaran, dan hitungan chip.

Aturannya harus sama dengan utils/bengkelTransaction.ts (getBengkelQueuePaymentStatus).
Data uji memakai tanggal khusus supaya tidak tercampur dengan data lain.
"""
from datetime import date
from decimal import Decimal

import pytest

from app.database import SessionLocal
from app.models.bengkel import TransaksiPenjualanBengkel
from app.services.transaksi_bengkel_service import TransaksiBengkelService

TANGGAL = date(2001, 1, 15)
PREFIX = "TEST-ANTRIAN-"


def _baris(nomor, status_bayar, status_pengerjaan, kategori="umum", dibayar="0", total="100000"):
    return TransaksiPenjualanBengkel(
        nomor_transaksi=f"{PREFIX}{nomor}",
        tanggal=TANGGAL,
        kategori=kategori,
        total_parts=Decimal("0"),
        total_jasa=Decimal(total),
        subtotal=Decimal(total),
        diskon=Decimal("0"),
        grand_total=Decimal(total),
        hpp_parts=Decimal("0"),
        laba_kotor=Decimal(total),
        jumlah_bayar=Decimal(dibayar),
        kembalian=Decimal("0"),
        status_pengerjaan=status_pengerjaan,
        status_bayar=status_bayar,
    )


@pytest.fixture
def data():
    db = SessionLocal()
    db.query(TransaksiPenjualanBengkel).filter(TransaksiPenjualanBengkel.nomor_transaksi.like(f"{PREFIX}%")).delete(synchronize_session=False)
    db.add_all([
        _baris("A", "BELUM_LUNAS", "ANTRE"),                       # belum bayar, antre
        _baris("B", "CICILAN", "PROSES", dibayar="40000"),          # sebagian dibayar, proses
        _baris("C", "LUNAS", "SELESAI", dibayar="100000"),          # lunas, selesai
        _baris("D", "BATAL", "BATAL"),                              # dibatalkan
        _baris("E", "INTERNAL", "SELESAI", kategori="jasa_angkut"), # internal jasa angkut
    ])
    db.commit()
    yield db
    db.rollback()
    db.query(TransaksiPenjualanBengkel).filter(TransaksiPenjualanBengkel.nomor_transaksi.like(f"{PREFIX}%")).delete(synchronize_session=False)
    db.commit()
    db.close()


def _nomor(hasil):
    return sorted(t.nomor_transaksi.replace(PREFIX, "") for t in hasil["data"])


def _list(db, **kw):
    return TransaksiBengkelService(db).get_list(
        skip=0, limit=100, tanggal_dari=TANGGAL, tanggal_sampai=TANGGAL, **kw
    )


def test_semua_tidak_menampilkan_batal(data):
    assert _nomor(_list(data, status_pengerjaan="ALL")) == ["A", "B", "C", "E"]


def test_filter_status_pengerjaan(data):
    assert _nomor(_list(data, status_pengerjaan="PROSES")) == ["B"]
    assert _nomor(_list(data, status_pengerjaan="BATAL")) == ["D"]


@pytest.mark.parametrize("pembayaran, hasil", [
    ("BELUM_BAYAR", ["A"]),
    ("BELUM_LUNAS", ["B"]),
    ("LUNAS", ["C"]),
    ("BATAL", ["D"]),
    ("INTERNAL", ["E"]),
])
def test_filter_pembayaran_sama_dengan_aturan_browser(data, pembayaran, hasil):
    assert _nomor(_list(data, pembayaran=pembayaran)) == hasil


def test_hitungan_chip_dihitung_sebelum_filter(data):
    hasil = _list(data, status_pengerjaan="PROSES", pembayaran="BELUM_LUNAS")
    assert _nomor(hasil) == ["B"]
    assert hasil["counts"]["work"] == {"total": 4, "antre": 1, "proses": 1, "selesai": 2, "batal": 1}
    assert hasil["counts"]["payment"] == {
        "total": 5, "LUNAS": 1, "BELUM_LUNAS": 1, "BELUM_BAYAR": 1, "BATAL": 1, "INTERNAL": 1,
    }


def test_tanpa_parameter_baru_perilaku_lama_tetap(data):
    assert _nomor(_list(data)) == ["A", "B", "C", "D", "E"]
