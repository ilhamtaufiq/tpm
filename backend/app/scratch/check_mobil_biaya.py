import sys
import os
from sqlalchemy import text

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from app.database.connection import SessionLocal

db = SessionLocal()
res = db.execute(text("SELECT id, kategori, deskripsi, jumlah FROM mobil_biaya_lainnya WHERE mobil_id = 7")).fetchall()

print("--- MOBIL BIAYA LAINNYA ID 7 ---")
for r in res:
    print(r)

db.close()
