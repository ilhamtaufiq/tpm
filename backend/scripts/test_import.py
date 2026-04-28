"""Test import fix: verify Total Modal matches Total Fix after import"""
import os, sys
sys.path.insert(0, '.')
os.environ.setdefault('DATABASE_URL', 'mysql+pymysql://root:@localhost/tpm')

from app.database import SessionLocal
from app.services.spare_part_service import SparePartService

db = SessionLocal()
svc = SparePartService(db)

# Read Excel file
with open(r'c:\laragon\www\tpm\stock 10.4.26-1775809768186.xlsx', 'rb') as f:
    content = f.read()

# Run import
result = svc.import_from_excel(content)

print("=== IMPORT RESULT ===")
for k, v in result.items():
    if k == 'errors':
        print(f"  errors_count: {len(v)}")
    elif k == 'modal_warning':
        print(f"  modal_warning: {v}")
    else:
        print(f"  {k}: {v}")

print()
sv = svc.get_stock_value()
print(f"Stock Value: total_value={sv['total_value']:,.0f}, products={sv['total_products']}")

print()
from datetime import date
from app.services.reports.neraca_service import NeracaService
n = NeracaService(db).get_report(date(2026, 4, 28))
print(f"Neraca: aktiva={n['total_aktiva']:,.0f}, pasiva={n['total_pasiva']:,.0f}, selisih={n['selisih']:,.0f}")
print(f"  persediaan_sparepart={n['aktiva_lancar']['persediaan_sparepart']:,.0f}")

db.close()
