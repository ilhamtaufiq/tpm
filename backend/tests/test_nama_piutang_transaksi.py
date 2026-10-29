"""Piutang dari transaksi unit diberi akhiran asal unit; piutang pribadi tetap nama aslinya."""
from app.utils.constants import PiutangSource
from app.utils.nama_piutang import (
    TAG_BENGKEL,
    TAG_JASA_ANGKUT,
    beri_tag_asal,
    ganti_nama_customer_di_piutang,
    nama_piutang_transaksi,
)


def test_piutang_bengkel_diberi_tag_bengkel():
    assert nama_piutang_transaksi("Akas alam", PiutangSource.BENGKEL) == "Akas alam - Bengkel"


def test_piutang_jasa_angkut_diberi_tag_jasa_angkut():
    assert nama_piutang_transaksi("Mang Usa", PiutangSource.JASA_ANGKUT) == "Mang Usa - Jasa Angkut"


def test_piutang_jb_mobil_tidak_diberi_tag_karena_sudah_bertanda():
    assert nama_piutang_transaksi("JB MOBIL - B 1 X", PiutangSource.JUAL_BELI_MOBIL) == "JB MOBIL - B 1 X"


def test_piutang_manual_tidak_diberi_tag():
    assert nama_piutang_transaksi("Pinjam buat beli oli", PiutangSource.LAINNYA) == "Pinjam buat beli oli"


def test_nama_customer_berubah_ikut_akhiran_tag():
    hasil = ganti_nama_customer_di_piutang(
        "Akas alam - Bengkel", "Akas alam", "Akas Alam Jaya", PiutangSource.BENGKEL
    )
    assert hasil == "Akas Alam Jaya - Bengkel"


def test_nama_customer_berubah_piutang_manual_ikut_berubah():
    hasil = ganti_nama_customer_di_piutang("Akas alam", "Akas alam", "Akas Alam Jaya", PiutangSource.LAINNYA)
    assert hasil == "Akas Alam Jaya"


def test_piutang_manual_dengan_nama_mirip_tidak_ikut_berubah():
    hasil = ganti_nama_customer_di_piutang("Pinjam Akas", "Akas alam", "Akas Alam Jaya", PiutangSource.BENGKEL)
    assert hasil == "Pinjam Akas"


def test_tag_jasa_angkut_tidak_tertukar_dengan_bengkel():
    assert beri_tag_asal("Armada 1", TAG_JASA_ANGKUT) != beri_tag_asal("Armada 1", TAG_BENGKEL)
