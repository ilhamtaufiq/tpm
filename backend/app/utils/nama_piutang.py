"""Penamaan piutang dan hutang yang lahir dari transaksi unit.

Piutang/hutang dari transaksi bengkel diberi akhiran asal unit, mis. "Akas alam - Bengkel",
supaya di Keuangan Pusat bisa dibedakan saat dicari per nama. Piutang pribadi yang diinput
manual tidak lewat sini dan tetap memakai nama dari keterangan.
"""
from app.utils.constants import PiutangSource

TAG_BENGKEL = "Bengkel"
TAG_JASA_ANGKUT = "Jasa Angkut"
TAG_JB_MOBIL = "Jual Beli Mobil"

# Tag asal per sumber piutang. JB Mobil tidak diberi tag karena namanya sudah "JB MOBIL - <plat>".
TAG_PER_SUMBER_PIUTANG = {
    PiutangSource.BENGKEL: TAG_BENGKEL,
    PiutangSource.JASA_ANGKUT: TAG_JASA_ANGKUT,
}


def beri_tag_asal(nama: str, tag: str) -> str:
    return f"{nama} - {tag}"


def nama_piutang_transaksi(nama: str, sumber: PiutangSource) -> str:
    tag = TAG_PER_SUMBER_PIUTANG.get(sumber)
    return beri_tag_asal(nama, tag) if tag else nama


def ganti_nama_customer_di_piutang(nama_sekarang: str, nama_lama: str, nama_baru: str, sumber: PiutangSource) -> str:
    """Nama customer berubah: ikut ganti nama piutang, termasuk akhiran asal unit-nya."""
    tag = TAG_PER_SUMBER_PIUTANG.get(sumber)
    if tag and nama_sekarang == beri_tag_asal(nama_lama, tag):
        return beri_tag_asal(nama_baru, tag)
    if nama_sekarang == nama_lama:
        return nama_baru
    return nama_sekarang
