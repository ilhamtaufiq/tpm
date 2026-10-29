"""Faktur penjualan mobil (PDF) dan terbilang."""
import os
import sys
from datetime import date
from decimal import Decimal
from types import SimpleNamespace

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.faktur_mobil_service import build_faktur_pdf  # noqa: E402
from app.utils.terbilang import terbilang  # noqa: E402


def test_terbilang_contoh_rupiah():
    assert terbilang(0) == "nol"
    assert terbilang(11) == "sebelas"
    assert terbilang(21) == "dua puluh satu"
    assert terbilang(100) == "seratus"
    assert terbilang(1000) == "seribu"
    assert terbilang(2000) == "dua ribu"
    assert terbilang(1250000) == "satu juta dua ratus lima puluh ribu"
    assert terbilang(1000000000) == "satu miliar"


def test_faktur_pdf_memuat_nomor_dan_terbilang():
    transaksi = SimpleNamespace(
        nomor_transaksi="PJM2610280001",
        tanggal=date(2026, 10, 28),
        nama_pembeli="Budi Test",
        telepon_pembeli="0812",
        alamat_pembeli="Cianjur",
        harga_jual=Decimal("150000000"),
        dp=Decimal("20000000"),
        sisa_bayar=Decimal("130000000"),
    )
    mobil = SimpleNamespace(
        merek="Toyota", model="Avanza", tahun=2018, warna="Hitam",
        nomor_plat="B 1234 TPM", nomor_rangka=None, nomor_mesin="MSN1",
    )
    pdf = build_faktur_pdf(transaksi, mobil)
    assert pdf.startswith(b"%PDF")
    assert b"PJM2610280001" in pdf
    assert b"Seratus lima puluh juta rupiah" in pdf
    assert b"Budi Test" in pdf
