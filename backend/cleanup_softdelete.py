"""
cleanup_softdelete.py
=====================
Hapus permanen semua record yang sudah di-soft-delete (deleted_at IS NOT NULL)
dari semua tabel yang menggunakan soft-delete.

Usage:
    python cleanup_softdelete.py          # Interactive (dengan konfirmasi)
    python cleanup_softdelete.py --yes    # Skip konfirmasi (untuk cron/automation)
    python cleanup_softdelete.py --dry    # Dry-run, hanya tampilkan jumlah tanpa hapus
"""

import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.database.connection import SessionLocal

# Semua tabel yang menggunakan kolom deleted_at (soft-delete)
SOFT_DELETE_TABLES = [
    "spare_parts",
    "customers",
    "mobils",
    "armada_jasa_angkut",
    "supirs",
    "jasa_servis",
    "karyawans",
    "suppliers",
]


def get_soft_deleted_counts(db) -> dict:
    """Hitung jumlah record soft-deleted per tabel."""
    counts = {}
    for table in SOFT_DELETE_TABLES:
        try:
            result = db.execute(
                text(f"SELECT COUNT(*) FROM `{table}` WHERE deleted_at IS NOT NULL")
            ).scalar()
            counts[table] = result or 0
        except Exception as e:
            counts[table] = f"ERROR: {e}"
    return counts


def cleanup_soft_deleted(dry_run=False):
    print("=" * 60)
    print("  CLEANUP SOFT-DELETED RECORDS")
    print("=" * 60)
    print()

    db = SessionLocal()

    try:
        # 1. Tampilkan jumlah record soft-deleted per tabel
        counts = get_soft_deleted_counts(db)

        total = 0
        print(f"  {'Tabel':<25} {'Jumlah Soft-Deleted':>20}")
        print(f"  {'-'*25} {'-'*20}")
        for table, count in counts.items():
            if isinstance(count, int):
                total += count
                marker = " ← ada data" if count > 0 else ""
                print(f"  {table:<25} {count:>20,}{marker}")
            else:
                print(f"  {table:<25} {str(count):>20}")

        print(f"  {'-'*25} {'-'*20}")
        print(f"  {'TOTAL':<25} {total:>20,}")
        print()

        if total == 0:
            print("✅ Tidak ada record soft-deleted. Database sudah bersih!")
            return

        if dry_run:
            print("🔍 Mode DRY-RUN: tidak ada data yang dihapus.")
            return

        # 2. Hapus permanen
        print("🗑️  Menghapus record soft-deleted secara permanen...")
        print()

        # Disable FK checks untuk menghindari constraint errors
        db.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))

        deleted_total = 0
        for table, count in counts.items():
            if isinstance(count, int) and count > 0:
                db.execute(
                    text(f"DELETE FROM `{table}` WHERE deleted_at IS NOT NULL")
                )
                deleted_total += count
                print(f"  ✓ {table}: {count:,} record dihapus")

        # Re-enable FK checks
        db.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))

        db.commit()

        print()
        print(f"✅ Selesai! Total {deleted_total:,} record dihapus permanen.")

    except Exception as e:
        db.rollback()
        try:
            db.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
            db.commit()
        except:
            pass
        print(f"\n❌ ERROR: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    args = sys.argv[1:]

    dry_run = "--dry" in args
    skip_confirm = "--yes" in args or "-y" in args

    if not skip_confirm and not dry_run:
        print()
        confirm = input("Apakah Anda yakin ingin menghapus permanen semua data soft-deleted? (ketik 'HAPUS'): ")
        if confirm != "HAPUS":
            print("Dibatalkan.")
            sys.exit(0)

    cleanup_soft_deleted(dry_run=dry_run)
