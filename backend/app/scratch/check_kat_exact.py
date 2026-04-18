import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from app.database.connection import SessionLocal
from sqlalchemy import text

db = SessionLocal()
r = db.execute(text("SELECT kategori FROM pengeluaran_bengkel WHERE id = 13")).fetchone()
print(f"Kategori: |{r[0]}|")
db.close()
