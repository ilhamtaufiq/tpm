import sys
import os
from sqlalchemy import text

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from app.database.connection import SessionLocal
from app.models.bengkel import PengeluaranBengkel

db = SessionLocal()

print("--- FIXING EXISTING EXPENSE CATEGORIES ---")

# Update records where description suggests it's Pajak, BBN, etc.
# These should be BIAYA_LAINNYA (Row 2b)
targets = ["Pajak", "BBN", "Lainnya", "Biaya Unit"]

count = 0
for t in targets:
    # Use deskripsi prefix or content
    res = db.execute(text(f"UPDATE pengeluaran_bengkel SET kategori = 'BIAYA_LAINNYA' WHERE bisnis_kategori = 'mobil' AND (deskripsi LIKE '%{t}%' OR deskripsi LIKE '[{t}]%')"))
    count += res.rowcount

# Ensure repairs are BIAYA_OPERASIONAL
res = db.execute(text("UPDATE pengeluaran_bengkel SET kategori = 'BIAYA_OPERASIONAL' WHERE bisnis_kategori = 'mobil' AND (deskripsi LIKE '%Bengkel%' OR deskripsi LIKE '%Perawatan%' OR deskripsi LIKE '[Perawatan Bengkel]%')"))
rep_count = res.rowcount

db.commit()
print(f"Updated {count} records to BIAYA_LAINNYA (Row 2b).")
print(f"Updated {rep_count} records to BIAYA_OPERASIONAL (Row 3).")
db.close()
