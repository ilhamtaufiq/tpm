"""
Script: Kembalikan transaksi yang tanggalnya melewati hari input ke hari input.

Kasus 5 Okt 2026: sejak ±15:00 perangkat kasir mengirim tanggal 06-10 untuk
kas, pengeluaran, piutang, dan hutang. Baris bertanggal besok tidak terhitung di
Neraca/Kas hari ini, sehingga saldo sistem beda dengan saldo real. Sekarang
input semacam ini ditolak (schema + KasBankService), tapi baris lama perlu
dikoreksi.

Kandidat: baris dengan `tanggal > DATE(created_at)` (tanggal dicatat lebih maju
dari hari input). Koreksi: `tanggal = DATE(created_at)`, lalu saldo berjalan
kas/bank dihitung ulang (`rebuild_balances`).

Pemakaian (dari folder backend/):
    python scripts/fix_tanggal_masa_depan.py                     # deteksi saja
    python scripts/fix_tanggal_masa_depan.py --apply             # perbaiki semua kandidat
    python scripts/fix_tanggal_masa_depan.py --apply --tanggal 2026-10-06
                                                                 # hanya baris bertanggal itu
    python scripts/fix_tanggal_masa_depan.py --apply --kecuali kas_bank:30,35,36 pengeluaran_bengkel:16,17
                                                                 # baris yang memang milik tanggal itu dilewati
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DATABASE_URL', 'mysql+pymysql://root:@localhost/tpm')

from sqlalchemy import text

from app.database import SessionLocal
from app.services.kas_bank_service import KasBankService


def tabel_bertanggal(db):
    """Semua tabel yang punya kolom `tanggal` dan `created_at`."""
    rows = db.execute(text(
        "SELECT table_name FROM information_schema.columns "
        "WHERE table_schema = DATABASE() AND column_name IN ('tanggal', 'created_at') "
        "GROUP BY table_name HAVING COUNT(*) = 2 ORDER BY table_name"
    )).fetchall()
    return [r[0] for r in rows]


def kandidat(db, tabel, tanggal=None):
    sql = (
        f"SELECT id, tanggal, created_at FROM `{tabel}` "
        "WHERE tanggal > DATE(created_at)"
    )
    params = {}
    if tanggal:
        sql += " AND tanggal = :tgl"
        params["tgl"] = tanggal
    return db.execute(text(sql + " ORDER BY id"), params).fetchall()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--apply', action='store_true', help='Tulis perbaikan (default: deteksi saja)')
    parser.add_argument('--tanggal', help='Batasi ke baris bertanggal ini (YYYY-MM-DD)')
    parser.add_argument('--kecuali', nargs='*', default=[], metavar='TABEL:ID,ID',
                        help='Lewati baris ini (transaksi yang memang milik tanggal tersebut)')
    args = parser.parse_args()
    kecuali = {}
    for item in args.kecuali:
        tabel, _, ids = item.partition(':')
        kecuali.setdefault(tabel, set()).update(int(i) for i in ids.split(',') if i)

    db = SessionLocal()
    try:
        total = 0
        for tabel in tabel_bertanggal(db):
            rows = [r for r in kandidat(db, tabel, args.tanggal) if r.id not in kecuali.get(tabel, ())]
            if not rows:
                continue
            total += len(rows)
            print(f"\n[{tabel}] {len(rows)} baris")
            for r in rows:
                print(f"  id={r.id:<6} tanggal={r.tanggal}  diinput={r.created_at}")
            if args.apply:
                ids = ",".join(str(int(r.id)) for r in rows)
                db.execute(text(
                    f"UPDATE `{tabel}` SET tanggal = DATE(created_at) WHERE id IN ({ids})"
                ))

        if not total:
            print("Tidak ada transaksi bertanggal melewati hari input.")
            return
        if not args.apply:
            print(f"\n{total} baris kandidat. Jalankan dengan --apply untuk memperbaiki.")
            return

        db.commit()
        KasBankService(db).rebuild_balances()
        db.commit()
        print(f"\n{total} baris dikoreksi ke tanggal input; saldo kas/bank dihitung ulang.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == '__main__':
    main()
