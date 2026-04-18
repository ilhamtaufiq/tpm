import sys
import os
from sqlalchemy import text

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from app.database.connection import SessionLocal

db = SessionLocal()
res = db.execute(text("SELECT id, kategori, bisnis_kategori, jumlah, deskripsi, tanggal FROM pengeluaran_bengkel WHERE jumlah = 100000")).fetchall()

print("--- 100K ENTRIES ---")
for r in res:
    print(r)

db.close()
