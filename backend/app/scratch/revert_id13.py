import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from app.database.connection import SessionLocal
from sqlalchemy import text

db = SessionLocal()
db.execute(text("UPDATE pengeluaran_bengkel SET kategori = 'BIAYA_LAINNYA' WHERE id = 13"))
db.commit()
print("Reverted ID 13 category to BIAYA_LAINNYA")
db.close()
