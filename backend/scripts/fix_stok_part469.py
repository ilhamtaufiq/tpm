"""
Fix stok Part 469 (LEM THREEBOND SI00007) di server production.

Masalah: stok tercatat 7, seharusnya 6.
Penyebab: race condition saat 2 nota diproses bersamaan,
          1 pengurangan stok hilang.
Dampak: neraca meleset Rp25.000.

Cara pakai di server:
    cd /path/to/tpm/backend
    python scripts/fix_stok_part469.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.connection import SessionLocal
from app.models.bengkel import SparePart

PART_ID = 469
EXPECTED_BEFORE = 7.0
CORRECT_STOK = 6.0


def main():
    db = SessionLocal()
    try:
        sp = db.query(SparePart).filter(SparePart.id == PART_ID).with_for_update().first()

        if not sp:
            print(f"GAGAL: Part ID {PART_ID} tidak ditemukan.")
            return

        print(f"Part {PART_ID}: {sp.nama}")
        print(f"  Stok saat ini : {sp.stok}")
        print(f"  Harga beli    : {sp.harga_beli}")

        current = float(sp.stok)

        if current == CORRECT_STOK:
            print(f"\n  Stok sudah benar ({CORRECT_STOK}). Tidak perlu diubah.")
            return

        if current != EXPECTED_BEFORE:
            print(f"\n  PERINGATAN: stok={current}, bukan {EXPECTED_BEFORE} seperti yang diharapkan.")
            print(f"  Kemungkinan sudah ada transaksi baru. Cek manual dulu.")
            return

        sp.stok = CORRECT_STOK
        db.commit()

        # Verifikasi
        db.refresh(sp)
        print(f"\n  BERHASIL: stok diubah {EXPECTED_BEFORE} -> {sp.stok}")
        print(f"  Selisih neraca Rp{(EXPECTED_BEFORE - CORRECT_STOK) * float(sp.harga_beli):,.0f} sudah terkoreksi.")

    finally:
        db.close()


if __name__ == "__main__":
    main()
