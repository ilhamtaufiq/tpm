
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from sqlalchemy import text

def check():
    db = SessionLocal()
    try:
        print("--- DISTINCT bisnis_kategori in pengeluaran_bengkel ---")
        result = db.execute(text("SELECT bisnis_kategori, COUNT(*) FROM pengeluaran_bengkel GROUP BY bisnis_kategori")).all()
        for row in result:
            print(f"[{row[0]}] : {row[1]} records")
            
        print("\n--- RECENT Pengeluaran ---")
        result = db.execute(text("SELECT id, keterangan, jumlah, bisnis_kategori FROM pengeluaran_bengkel ORDER BY id DESC LIMIT 10")).all()
        for row in result:
            print(f"ID: {row[0]}, Desc: {row[1]}, Amount: {row[2]}, Unit: {row[3]}")
    finally:
        db.close()

if __name__ == "__main__":
    check()
