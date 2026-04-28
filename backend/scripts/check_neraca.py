import os, sys
sys.path.insert(0, '.')
os.environ.setdefault('DATABASE_URL', 'mysql+pymysql://root:@localhost/tpm')

from datetime import date
from app.database import SessionLocal
from app.services.reports.neraca_service import NeracaService
from app.models.keuangan import KasBank, Aset

db = SessionLocal()
n = NeracaService(db).get_report(date(2026, 4, 28))

print("=== NERACA STATE ===")
print("AKTIVA:")
al = n['aktiva_lancar']
print("  kas_tunai:", al["kas_tunai"])
print("  kas_bank:", al["kas_bank"])
print("  unit_cash:", al["unit_cash"])
print("  piutang:", al["total_piutang"])
print("  sparepart:", al["persediaan_sparepart"])
print("  stok_mobil:", al["stok_mobil"])
print("  aset_tetap:", n["aktiva_tetap"]["total_aktiva_tetap"])
print("  TOTAL AKTIVA:", n["total_aktiva"])
print()
print("PASIVA:")
print("  hutang:", n["hutang"]["total_hutang"])
m = n['modal']
print("  setoran_modal:", m["setoran_modal"])
print("  laba_ditahan:", m["laba_ditahan"])
print("  prive:", m["prive"])
print("  TOTAL MODAL:", m["total_modal"])
print("  TOTAL PASIVA:", n["total_pasiva"])
print()
print("SELISIH:", n["selisih"])

# Check KasBank
kb_count = db.query(KasBank).count()
print("\nKasBank entries:", kb_count)

# Check Assets
assets = db.query(Aset).all()
print("Assets:", len(assets))
for a in assets:
    print("  ", a.nama, ":", float(a.harga_beli), "status=", a.status)

db.close()
