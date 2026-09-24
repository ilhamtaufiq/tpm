"""Backfill: hapus SparePartRevaluationRelease yang berasal dari reval koreksi-qty.

Latar: `_release_revaluation` (transaksi_bengkel_service) merilis reserve FIFO atas
SEMUA reval part, termasuk `is_qty_correction=True`. Padahal neraca (base.py)
sengaja mengecualikan qty-correction dari `total_reval`, sehingga amount release-nya
mengurangi `total_released` tanpa pasangan -> `reval_reserve` over-subtracted ->
persediaan sparepart KURANG sebesar itu.

Kode sudah diperbaiki (commit 940c7511), tapi release lama yang sudah tertulis di DB
tidak ikut terhapus oleh git push. Script ini yang membersihkannya.

Idempoten. Tidak mengubah stok part — release murni efek akuntansi reserve.

Dry-run (default):
    python scripts/backfill_reval_qty_correction.py

Eksekusi:
    python scripts/backfill_reval_qty_correction.py --apply
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.connection import SessionLocal
from app.models.bengkel import (
    SparePart,
    SparePartRevaluation,
    SparePartRevaluationRelease,
)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="tulis perubahan (default: dry-run)")
    args = ap.parse_args()

    db = SessionLocal()
    try:
        rows = (
            db.query(SparePartRevaluationRelease, SparePartRevaluation)
            .join(
                SparePartRevaluation,
                SparePartRevaluationRelease.revaluation_id == SparePartRevaluation.id,
            )
            .filter(SparePartRevaluation.is_qty_correction == True)  # noqa: E712
            .all()
        )

        if not rows:
            print("OK: tidak ada release dari reval koreksi-qty. Tidak ada yang perlu dihapus.")
            return 0

        total = 0.0
        part_ids = set()
        print(f"Ditemukan {len(rows)} release dari reval koreksi-qty:\n")
        for rel, rv in rows:
            sp = db.get(SparePart, rv.spare_part_id)
            part_ids.add(rv.spare_part_id)
            total += float(rel.amount)
            print(
                f"  release_id={rel.id:<5} reval_id={rv.id:<5} part={rv.spare_part_id:<5} "
                f"{(sp.nama[:32] if sp else '?'):<34} trx={rel.transaksi_id:<5} "
                f"tgl={rel.tanggal} qty={float(rel.qty):>8.2f} amount={float(rel.amount):>14,.2f}"
            )

        # Snapshot stok sebelum, untuk membuktikan script tidak menyentuh stok.
        stok_sebelum = {
            pid: float(db.get(SparePart, pid).stok) for pid in part_ids if db.get(SparePart, pid)
        }

        print(f"\n  TOTAL amount  : {total:,.2f}")
        print(f"  Efek ke neraca: persediaan sparepart +{abs(total):,.2f}")
        print(f"  Stok part sebelum: {stok_sebelum}")

        if not args.apply:
            print("\nDRY-RUN. Jalankan ulang dengan --apply untuk menghapus.")
            return 0

        for rel, _rv in rows:
            db.delete(rel)
        db.commit()

        stok_sesudah = {
            pid: float(db.get(SparePart, pid).stok) for pid in part_ids if db.get(SparePart, pid)
        }
        assert stok_sebelum == stok_sesudah, f"stok berubah! {stok_sebelum} -> {stok_sesudah}"

        sisa = (
            db.query(SparePartRevaluationRelease)
            .join(
                SparePartRevaluation,
                SparePartRevaluationRelease.revaluation_id == SparePartRevaluation.id,
            )
            .filter(SparePartRevaluation.is_qty_correction == True)  # noqa: E712
            .count()
        )
        assert sisa == 0, f"masih ada {sisa} release tersisa"

        print(f"\nSELESAI. {len(rows)} release dihapus, stok tidak berubah.")
        print("Restart backend supaya laporan menghitung ulang.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
