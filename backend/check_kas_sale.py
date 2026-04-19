
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.database import SessionLocal
from app.models.keuangan import KasBank

db = SessionLocal()
try:
    # Check for entries related to Sale #3 (ID: 3)
    kas = db.query(KasBank).filter(KasBank.referensi_id == 3).filter(KasBank.sumber == "JUAL_BELI_MOBIL").all()
    if kas:
        print(f"Found {len(kas)} Kas entries for Sale #3.")
        for k in kas:
            print(f"- {k.nomor_referensi}: {k.nominal} ({k.metode_bayar}) - {k.keterangan}")
    else:
        print("No Kas entries found for Sale #3.")
finally:
    db.close()
