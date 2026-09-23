"""
Deploy script: fix perubahan modal selisih -25.000.

Masalah:
  - Neraca balance, tapi perubahan modal selisih -25.000
  - Penyebab: race condition stok part 469 (stok 7→6, harga_beli 25.000)
  - Stok sudah dikoreksi ke 6, tapi modal teoritis belum menyesuaikan

Solusi:
  1. ALTER TABLE spare_part_revaluation — tambah kolom is_qty_correction
  2. Insert revaluasi qty correction part 469 (amount=-25.000)
  3. Kolom ini dipakai oleh modal_service tapi DIABAIKAN oleh neraca
     (neraca sudah benar, tidak perlu double-count)

Cara pakai di server:
    cd /path/to/tpm/backend
    python scripts/deploy_modal_fix.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.connection import SessionLocal
from sqlalchemy import text, func
from app.models.bengkel import SparePartRevaluation, SparePart
from datetime import date

PART_ID = 469


def main():
    db = SessionLocal()
    try:
        # Step 1: ALTER TABLE
        print("Step 1: Tambah kolom is_qty_correction...")
        try:
            db.execute(text(
                "ALTER TABLE spare_part_revaluation "
                "ADD COLUMN is_qty_correction TINYINT(1) NOT NULL DEFAULT 0"
            ))
            db.commit()
            print("  Kolom ditambahkan.")
        except Exception as e:
            db.rollback()
            if "Duplicate" in str(e):
                print("  Kolom sudah ada. Skip.")
            else:
                raise

        # Step 2: Insert qty correction
        print("\nStep 2: Insert qty correction untuk part 469...")
        existing = db.query(SparePartRevaluation).filter(
            SparePartRevaluation.spare_part_id == PART_ID,
            SparePartRevaluation.is_qty_correction == True  # noqa: E712
        ).first()

        if existing:
            print(f"  Sudah ada: id={existing.id}, amount={existing.amount}. Skip.")
        else:
            sp = db.query(SparePart).filter(SparePart.id == PART_ID).first()
            if not sp:
                print(f"  GAGAL: Part {PART_ID} tidak ditemukan.")
                return

            rev = SparePartRevaluation(
                spare_part_id=PART_ID,
                pembelian_id=None,
                tanggal=date.today(),
                qty_at_reval=float(sp.stok),
                harga_lama=float(sp.harga_beli),
                harga_baru=float(sp.harga_beli),
                amount=-25000.0,
                is_qty_correction=True,
            )
            db.add(rev)
            db.commit()
            print(f"  Inserted: id={rev.id}, amount={rev.amount}")

        # Step 3: Verify
        print("\nStep 3: Verifikasi...")
        sp = db.query(SparePart).filter(SparePart.id == PART_ID).first()
        print(f"  Part {PART_ID} stok = {sp.stok}")

        reval_all = float(db.query(func.sum(SparePartRevaluation.amount)).filter(
            SparePartRevaluation.is_qty_correction == True  # noqa: E712
        ).scalar() or 0)
        print(f"  qty_correction_total = {reval_all:,.2f}")
        print("\nSelesai. Restart backend jika perlu.")

    finally:
        db.close()


if __name__ == "__main__":
    main()
