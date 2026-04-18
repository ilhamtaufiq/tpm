import sys
import os
from datetime import date
from decimal import Decimal
from sqlalchemy import text

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from app.database.connection import SessionLocal
from app.models.bengkel import PengeluaranBengkel
from app.models.mobil import MobilBiayaLainnya

db = SessionLocal()

print("--- SYNCING PengeluaranBengkel -> MobilBiayaLainnya ---")

# Find all car expenses in ledger that don't have a record in MobilBiayaLainnya
# Based on the latest pattern: deskripsi contains [Kategori] 
query = db.query(PengeluaranBengkel).filter(
    PengeluaranBengkel.bisnis_kategori == 'mobil',
    PengeluaranBengkel.mobil_id.is_not(None)
)

count = 0
for exp in query:
    # Check if already exists in MobilBiayaLainnya
    # We look for records with same mobil_id, amount, and date
    exists = db.query(MobilBiayaLainnya).filter(
        MobilBiayaLainnya.mobil_id == exp.mobil_id,
        MobilBiayaLainnya.jumlah == exp.jumlah,
        MobilBiayaLainnya.tanggal == exp.tanggal
    ).first()
    
    if not exists:
        # Extract kategori from deskripsi: "[Pajak] ..." -> "Pajak"
        kategori = "Lainnya"
        deskripsi = exp.deskripsi
        if exp.deskripsi.startswith("[") and "]" in exp.deskripsi:
            kategori = exp.deskripsi[1:exp.deskripsi.find("]")]
            deskripsi = exp.deskripsi[exp.deskripsi.find("]")+2:]
            
        new_b = MobilBiayaLainnya(
            mobil_id=exp.mobil_id,
            tanggal=exp.tanggal,
            kategori=kategori,
            deskripsi=deskripsi,
            jumlah=exp.jumlah,
            catatan=f"Synced ID: {exp.id}"
        )
        db.add(new_b)
        count += 1
        print(f"Synced expense {exp.id} as {kategori}: {deskripsi}")

db.commit()
print(f"Successfully synced {count} records.")
db.close()
