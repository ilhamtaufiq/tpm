import sys
import os
from sqlalchemy import text

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from app.database.connection import SessionLocal

db = SessionLocal()
# Check recent bengkel transactions for Mobil 7
res = db.execute(text("SELECT id, nomor_transaksi, grand_total, status_bayar, created_at, status_pengerjaan, kategori FROM transaksi_penjualan_bengkel WHERE mobil_id = 7 ORDER BY created_at DESC")).fetchall()

print("--- BENGKEL TRANSACTIONS FOR MOBIL 7 ---")
for r in res:
    print(r)

# Also check ledger
res_ledger = db.execute(text("SELECT id, kategori, deskripsi, jumlah, bisnis_kategori FROM pengeluaran_bengkel WHERE mobil_id = 7")).fetchall()
print("\n--- LEDGER ENTRIES FOR MOBIL 7 ---")
for rl in res_ledger:
    print(rl)

db.close()
