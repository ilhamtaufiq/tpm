"""
Script: Perbaiki baris kas_bank yang akunnya salah karena metode bayar.

Defect class: `metode_bayar == 'TRANSFER'` tapi `jenis` adalah akun kas tunai
(KAS_UTAMA / CASH / KAS_UNIT_*). Policy `get_kas_jenis` menetapkan TRANSFER
harus masuk BANK_UTAMA. Penyebabnya: `kas_jenis` dari request menimpa policy.

PENTING: tidak semua baris sekelas ini adalah bug. Sebagian sudah "dikompensasi"
manual oleh user lewat entri `Transfer ke BANK_UTAMA` sesudahnya (uang memang
mampir ke dompet unit lalu disetor). Memindahkan baris seperti itu akan
membuat dompet unit minus. Script ini karena itu TIDAK menebak: ia menampilkan
konteks ledger tiap kandidat, dan hanya memperbaiki ID yang diminta eksplisit.

Pemakaian (dari folder backend/):
    python scripts/fix_kas_akun_salah_metode.py                    # deteksi saja
    python scripts/fix_kas_akun_salah_metode.py --show 93          # detail + ledger
    python scripts/fix_kas_akun_salah_metode.py --apply --ids 93   # perbaiki
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DATABASE_URL', 'mysql+pymysql://root:@localhost/tpm')

from app.database import SessionLocal
from app.models.keuangan import KasBank
from app.services.kas_bank_integration import get_kas_jenis
from app.services.kas_bank_service import KasBankService
from app.utils.constants import KasBankJenis, PaymentMethod

KAS_ACCOUNTS = [
    KasBankJenis.CASH,
    KasBankJenis.KAS_UTAMA,
    KasBankJenis.KAS_UNIT_BENGKEL,
    KasBankJenis.KAS_UNIT_JASA_ANGKUT,
    KasBankJenis.KAS_UNIT_MOBIL,
]


def find_candidates(db):
    return (
        db.query(KasBank)
        .filter(
            KasBank.metode_bayar == PaymentMethod.TRANSFER,
            KasBank.jenis.in_(KAS_ACCOUNTS),
        )
        .order_by(KasBank.id)
        .all()
    )


def print_ledger(db, jenis, highlight=None):
    rows = db.query(KasBank).filter(KasBank.jenis == jenis).order_by(KasBank.id).all()
    print(f"    --- ledger {jenis.value} ({len(rows)} baris) ---")
    for r in rows:
        mark = " <<<" if highlight and r.id == highlight else ""
        metode = r.metode_bayar.value if r.metode_bayar else "-"
        print(
            f"    id={r.id:4} {r.tipe.value:6} {r.nominal:>14,.0f} "
            f"saldo {r.saldo_sebelum:>14,.0f} -> {r.saldo_sesudah:>14,.0f} "
            f"{metode:8} {str(r.nomor_referensi):22} | {r.keterangan[:44]}{mark}"
        )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="tulis perubahan (default: kering)")
    ap.add_argument("--ids", type=int, nargs="*", default=[], help="ID kas_bank yang diperbaiki")
    ap.add_argument("--show", type=int, default=None, help="tampilkan detail + ledger satu baris")
    args = ap.parse_args()

    db = SessionLocal()
    try:
        candidates = find_candidates(db)
        print(f"Kandidat (TRANSFER pada akun kas tunai): {len(candidates)} baris\n")
        for k in candidates:
            target = get_kas_jenis(k.metode_bayar, k.sumber)
            flag = "PERLU-DIPERIKSA" if target != k.jenis else "ok"
            print(
                f"  id={k.id:4} {k.nomor_transaksi:16} {k.tanggal} {k.jenis.value:22} "
                f"{k.tipe.value:6} {k.nominal:>14,.0f} {str(k.nomor_referensi):18} [{flag}]"
            )
            print(f"        {k.keterangan[:90]}")

        if args.show:
            k = db.query(KasBank).filter(KasBank.id == args.show).first()
            if not k:
                print(f"\nID {args.show} tidak ditemukan.")
                return 1
            target = get_kas_jenis(k.metode_bayar, k.sumber)
            print(f"\n=== DETAIL id={args.show} ===")
            print(f"  nomor_transaksi : {k.nomor_transaksi}")
            print(f"  tanggal         : {k.tanggal}")
            print(f"  jenis (sekarang): {k.jenis.value}")
            print(f"  jenis (policy)  : {target.value}")
            print(f"  tipe / nominal  : {k.tipe.value} / {k.nominal:,.0f}")
            print(f"  sumber          : {k.sumber.value}")
            print(f"  metode_bayar    : {k.metode_bayar.value}")
            print(f"  referensi       : {k.nomor_referensi} (ref_id={k.referensi_id})")
            print(f"  keterangan      : {k.keterangan}")
            print_ledger(db, k.jenis, highlight=k.id)
            print_ledger(db, target)

        if not args.apply:
            print("\nMode kering. Tambahkan --apply --ids <ID...> untuk menulis.")
            return 0

        if not args.ids:
            print("\n--apply butuh --ids yang eksplisit.")
            return 1

        rows = db.query(KasBank).filter(KasBank.id.in_(args.ids)).order_by(KasBank.id).all()
        if len(rows) != len(set(args.ids)):
            print(f"\nID tidak ditemukan: {sorted(set(args.ids) - {r.id for r in rows})}")
            return 1

        affected = set()
        for k in rows:
            target = get_kas_jenis(k.metode_bayar, k.sumber)
            if target == k.jenis:
                print(f"  id={k.id} sudah benar ({k.jenis.value}), dilewati.")
                continue
            print(f"  id={k.id} {k.nomor_transaksi}: {k.jenis.value} -> {target.value}")
            affected.add(k.jenis)
            affected.add(target)
            k.jenis = target

        if not affected:
            db.rollback()
            print("\nTidak ada yang berubah.")
            return 0

        db.flush()
        service = KasBankService(db)
        for jenis in sorted(affected, key=lambda j: j.value):
            result = service.rebuild_balances(jenis)
            print(f"  saldo {jenis.value} dihitung ulang: {result['updated']} baris")

        db.commit()
        print("\nSelesai. Saldo sudah direkalkulasi ulang.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
