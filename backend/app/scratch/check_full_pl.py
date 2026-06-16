import sys
import os
from datetime import date
from decimal import Decimal

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

try:
    from app.database.connection import SessionLocal
    from app.services.penjualan_mobil_service import PenjualanMobilService
    from app.services.pengeluaran_service import PengeluaranService
    from app.api.v1.dashboard import get_profit_summary
except ImportError as e:
    print(f"Import Error: {e}")
    sys.exit(1)

db = SessionLocal()
dari = date(2026, 4, 1)
sampai = date(2026, 4, 30)

print(f"--- ANALYZING P&L FOR {dari} to {sampai} ---")

# 1. Call PenjualanMobil summary
p_mobil = PenjualanMobilService(db)
mobil_res = p_mobil.get_summary(dari, sampai)
print(f"Mobil Summary Result: {mobil_res}")

# 2. Call Pengeluaran summary
p_exp = PengeluaranService(db)
exp_res = p_exp.get_summary(dari, sampai)
print(f"Pengeluaran Summary 'mobil_unit': {exp_res.get('mobil_unit')}")

# 3. Call full dashboard function
profit = get_profit_summary(db, dari, sampai)
print(f"FULL Dashboard 'mobil_details': {profit.get('mobil_details')}")
print(f"FULL Dashboard 'pengeluaran_unit_details': {profit.get('pengeluaran_unit_details')}")

db.close()
