"""Isi unit JUAL_BELI_MOBIL pada hutang sisa pembelian mobil (sumber PEMBELIAN_MOBIL) yang unit-nya kosong.

Hutang ini dulu dibuat tanpa unit, sehingga tidak muncul di menu Keuangan JB Mobil.
Hanya baris dengan unit kosong dan status tidak BATAL yang diubah; aman dijalankan ulang.

Pemakaian:
    python scripts/isi_unit_hutang_pembelian_mobil.py            # dry-run: hanya menampilkan
    python scripts/isi_unit_hutang_pembelian_mobil.py --apply    # simpan perubahan
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal  # noqa: E402
from app.models.keuangan import HutangUsaha  # noqa: E402
from app.utils.constants import HutangSource, HutangStatus, KasBankSource  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="simpan perubahan (default: dry-run)")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        rows = (
            db.query(HutangUsaha)
            .filter(
                HutangUsaha.sumber == HutangSource.PEMBELIAN_MOBIL,
                HutangUsaha.unit.is_(None),
                HutangUsaha.status != HutangStatus.BATAL,
            )
            .all()
        )
        print(f"Hutang pembelian mobil tanpa unit: {len(rows)}")
        for h in rows:
            print(f"  hutang id={h.id} {h.nomor_hutang}: '{h.nama_kreditur}' sisa={h.sisa_hutang}")
        if not args.apply:
            print("Dry-run: tidak ada yang disimpan. Jalankan dengan --apply untuk menyimpan.")
            return
        for h in rows:
            h.unit = KasBankSource.JUAL_BELI_MOBIL
        db.commit()
        print(f"Disimpan: {len(rows)} hutang.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
