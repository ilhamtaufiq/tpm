import sys
import os
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import func, or_

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

try:
    from app.database.connection import SessionLocal
    from app.models.bengkel import PengeluaranBengkel
    from app.models.mobil import TransaksiPenjualanMobil, Mobil, MobilBiayaLainnya
except ImportError as e:
    print(f"Import Error: {e}")
    sys.exit(1)

db = SessionLocal()

print("--- DEBUG DASHBOARD BARIS 2b ---")
today = date.today()
print(f"Date range assumed: {today} to {today}")

# 1. Total expenses for cars (today)
car_expenses = db.query(
    PengeluaranBengkel.mobil_id,
    func.sum(PengeluaranBengkel.jumlah)
).filter(
    PengeluaranBengkel.bisnis_kategori.in_(["mobil", "jual_beli_mobil", "penjualan_mobil"]),
    PengeluaranBengkel.tanggal == today
).group_by(PengeluaranBengkel.mobil_id).all()

print(f"Ledger Expenses (today) by Mobil ID: {car_expenses}")

# 2. Sold cars (today)
sold_mobil_ids = {str(r[0]) for r in db.query(TransaksiPenjualanMobil.mobil_id).filter(
    TransaksiPenjualanMobil.tanggal == today
).all()}
print(f"Sold Mobil IDs (today): {sold_mobil_ids}")

# 3. Calculate capital_unsold_mobil_ops
total_unsold = 0
for m_id, val in car_expenses:
    if str(m_id) not in sold_mobil_ids:
        total_unsold += float(val)
print(f"Total Unsold Ledger Expenses: {total_unsold}")

# 4. MobilBiayaLainnya (today) - "Perawatan Bengkel"
repair_costs = db.query(func.sum(MobilBiayaLainnya.jumlah)).filter(
    MobilBiayaLainnya.kategori == "Perawatan Bengkel",
    MobilBiayaLainnya.tanggal == today
).scalar() or 0
print(f"Total Repair Costs (MobilBiayaLainnya today): {repair_costs}")

# 5. Result for 2b
row_2b = max(0, total_unsold - float(repair_costs))
print(f"Expected Baris 2b: {row_2b}")

# Check what the user added specifically
user_pajak = db.query(PengeluaranBengkel).filter(
    PengeluaranBengkel.tanggal == today,
    PengeluaranBengkel.deskripsi.ilike("%Pajak%")
).all()
print(f"Pajak entries found in ledger: {[(e.id, e.jumlah, e.mobil_id, e.bisnis_kategori) for e in user_pajak]}")

# Check if MobilBiayaLainnya has Pajak too
user_pajak_m = db.query(MobilBiayaLainnya).filter(
    MobilBiayaLainnya.tanggal == today,
    MobilBiayaLainnya.kategori == "Pajak"
).all()
print(f"Pajak entries found in MobilBiayaLainnya: {[(e.id, e.jumlah, e.mobil_id) for e in user_pajak_m]}")

db.close()
