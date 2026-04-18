import sys
import os
from datetime import date
from sqlalchemy import text

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from app.database.connection import SessionLocal

db = SessionLocal()
# Direct SQL for speed and reliability on MySQL
res = db.execute(text("SELECT id, mobil_id, kategori, bisnis_kategori, jumlah, deskripsi, tanggal FROM pengeluaran_bengkel WHERE tanggal = CURDATE() OR tanggal = DATE_SUB(CURDATE(), INTERVAL 1 DAY)")).fetchall()

print("--- RECENT EXPENSES ---")
for r in res:
    print(r)

db.close()
