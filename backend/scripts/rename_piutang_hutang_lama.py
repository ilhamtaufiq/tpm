"""Rapikan nama piutang/hutang lama yang lahir dari transaksi unit (termasuk saldo awal impor).

Aturan (sama dengan app/utils/nama_piutang.py dan invarian 36):
- Piutang sumber BENGKEL      -> "<nama> - Bengkel"
- Piutang sumber JASA_ANGKUT  -> "<nama> - Jasa Angkut"
- Hutang internal "BENGKEL TPM" (sumber JUAL_BELI_MOBIL) -> "BENGKEL TPM - Jual Beli Mobil"
- Hutang internal "BENGKEL TPM" (sumber LAINNYA)         -> "BENGKEL TPM - Jasa Angkut"
- JB Mobil tidak diberi akhiran (namanya sudah "JB MOBIL - <plat>").
- Nama yang sudah berakhiran tag tidak diubah, sehingga skrip aman dijalankan ulang.
- Piutang/hutang dibatalkan (status BATAL) tidak diubah.

Pemakaian:
    python scripts/rename_piutang_hutang_lama.py            # dry-run: hanya menampilkan
    python scripts/rename_piutang_hutang_lama.py --apply    # simpan perubahan
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal  # noqa: E402
from app.models.keuangan import HutangUsaha, PiutangUsaha  # noqa: E402
from app.utils.constants import HutangSource, PiutangSource, PiutangStatus, HutangStatus  # noqa: E402
from app.utils.nama_piutang import (  # noqa: E402
    TAG_BENGKEL,
    TAG_JASA_ANGKUT,
    TAG_JB_MOBIL,
    beri_tag_asal,
)

PIUTANG_TAG = {
    PiutangSource.BENGKEL: TAG_BENGKEL,
    PiutangSource.JASA_ANGKUT: TAG_JASA_ANGKUT,
}
NAMA_INTERNAL_BENGKEL = "BENGKEL TPM"


def _sudah_bertag(nama: str, tag: str) -> bool:
    return (nama or "").rstrip().endswith(f" - {tag}")


def rencana_piutang(db):
    """Daftar (piutang, nama_baru) untuk piutang yang perlu diberi akhiran unit."""
    hasil = []
    for p in db.query(PiutangUsaha).filter(PiutangUsaha.sumber.in_(list(PIUTANG_TAG))).all():
        if p.status == PiutangStatus.BATAL:
            continue
        tag = PIUTANG_TAG[p.sumber]
        nama = (p.nama_debitur or "").strip()
        if not nama or _sudah_bertag(nama, tag):
            continue
        hasil.append((p, beri_tag_asal(nama, tag)))
    return hasil


def rencana_hutang(db):
    """Daftar (hutang, nama_baru) untuk hutang internal bengkel yang belum bertag unit."""
    hasil = []
    for h in db.query(HutangUsaha).filter(HutangUsaha.nama_kreditur == NAMA_INTERNAL_BENGKEL).all():
        if h.status == HutangStatus.BATAL:
            continue
        if h.sumber == HutangSource.JUAL_BELI_MOBIL:
            tag = TAG_JB_MOBIL
        elif h.sumber == HutangSource.LAINNYA:
            tag = TAG_JASA_ANGKUT
        else:
            continue
        hasil.append((h, beri_tag_asal(NAMA_INTERNAL_BENGKEL, tag)))
    return hasil


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="simpan perubahan (default: dry-run)")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        piutang = rencana_piutang(db)
        hutang = rencana_hutang(db)
        print(f"Piutang yang akan diberi akhiran: {len(piutang)}")
        for p, baru in piutang:
            print(f"  piutang id={p.id} {p.nomor_piutang}: '{p.nama_debitur}' -> '{baru}' ({p.sumber.value})")
        print(f"Hutang internal yang akan diberi akhiran: {len(hutang)}")
        for h, baru in hutang:
            print(f"  hutang id={h.id} {h.nomor_hutang}: '{h.nama_kreditur}' -> '{baru}' ({h.sumber.value})")

        if not args.apply:
            print("Dry-run: tidak ada yang disimpan. Jalankan dengan --apply untuk menyimpan.")
            return
        for p, baru in piutang:
            p.nama_debitur = baru
        for h, baru in hutang:
            h.nama_kreditur = baru
        db.commit()
        print(f"Disimpan: {len(piutang)} piutang dan {len(hutang)} hutang.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
