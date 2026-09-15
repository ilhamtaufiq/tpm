"""Trace komponen selisih Modal Aktual (Neraca) vs Modal Teoritis (Backend).

Usage: python diag_selisih_modal.py 2026-09-01 2026-09-30
"""
import sys
from datetime import date
from app.database.connection import SessionLocal
from app.services.reports.modal_service import ModalService

dari = date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else date(2026, 9, 1)
sampai = date.fromisoformat(sys.argv[2]) if len(sys.argv) > 2 else date(2026, 9, 30)

db = SessionLocal()
try:
    r = ModalService(db).get_report(dari, sampai)
    v = r["info"]["validasi"]
    print(f"periode            : {r['periode']}")
    print(f"modal_awal         : {r['modal_awal']:>18,.0f}")
    print(f"setoran_modal      : {r['penambahan']['setoran_modal']:>18,.0f}")
    print(f"setoran_non_kas_imp: {r['penambahan']['modal_non_kas']['total']:>18,.0f}")
    print(f"laba_bersih(SOT)   : {r['info']['laba_bersih']:>18,.0f}")
    print(f"prive              : {r['pengurangan']['prive']:>18,.0f}")
    print(f"pengembalian_modal : {r['pengurangan']['pengembalian_modal']:>18,.0f}")
    print("-" * 45)
    print(f"modal_teoritis     : {v['modal_teoritis']:>18,.0f}")
    print(f"modal_aktual       : {v['modal_aktual']:>18,.0f}")
    print(f"SELISIH            : {v['selisih']:>18,.0f}")
    print()
    print("--- komponen modal_aktual ---")
    a = r["info"]["aset"]
    for k in ("kas_bank", "stok_part", "aset_tetap"):
        print(f"{k:12s}        : {a[k]:>18,.0f}")
    print(f"{'stok_mobil':12s}.total  : {a['stok_mobil']['total']:>18,.0f}")
    print(f"{'piutang':12s}.total  : {a['piutang']['total']:>18,.0f}")
    print(f"{'hutang':12s}.total  : {a['hutang']['total']:>18,.0f}")
    print()
    print("--- bucket hutang ---")
    for k, val in (a["hutang"].get("breakdown") or {}).items():
        print(f"  {k:30s}: {float(val or 0):>18,.0f}")
    print("--- bucket piutang ---")
    for k, val in (a["piutang"].get("breakdown") or {}).items():
        print(f"  {k:30s}: {float(val or 0):>18,.0f}")
    print()
    print(f"modal_awal_as_of   : {r.get('modal_awal_as_of')}")
    print(f"modal_awal_penyes  : {r.get('modal_awal_penyesuaian'):>18,.0f}")
finally:
    db.close()
