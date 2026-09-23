"""
Deploy script: fix perubahan modal selisih -25.000.

Masalah:
  - Neraca balance, tapi perubahan modal selisih -25.000
  - Penyebab: race condition stok part 469 (stok 7→6, harga_beli 25.000)
  - Stok sudah dikoreksi ke 6, tapi modal teoritis belum menyesuaikan

Solusi:
  1. Jalankan alembic upgrade head — tambah kolom is_qty_correction + insert data
  2. Kolom ini dipakai oleh modal_service tapi DIABAIKAN oleh neraca

Cara pakai di server:
    cd /path/to/tpm/backend
    alembic upgrade head
    python scripts/deploy_modal_fix.py   # optional: verifikasi
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.connection import SessionLocal
from sqlalchemy import func
from app.models.bengkel import SparePartRevaluation

PART_ID = 469


def main():
    db = SessionLocal()
    try:
        print("Verifikasi setelah alembic upgrade head:")
        print()

        # Cek kolom ada
        existing = db.query(SparePartRevaluation).filter(
            SparePartRevaluation.spare_part_id == PART_ID,
            SparePartRevaluation.is_qty_correction == True  # noqa: E712
        ).first()

        if existing:
            print(f"  qty correction part {PART_ID}: id={existing.id}, amount={existing.amount}")
        else:
            print(f"  BELUM ADA qty correction untuk part {PART_ID}.")
            print(f"  Jalankan: alembic upgrade head")
            return

        # Total qty corrections
        reval_all = float(db.query(func.sum(SparePartRevaluation.amount)).filter(
            SparePartRevaluation.is_qty_correction == True  # noqa: E712
        ).scalar() or 0)
        print(f"  qty_correction_total = {reval_all:,.2f}")
        print("\nSelesai. Restart backend jika perlu.")

    finally:
        db.close()


if __name__ == "__main__":
    main()
