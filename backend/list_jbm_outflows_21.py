import os
import sys
from datetime import date, timedelta

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

from app.database.connection import SessionLocal
from app.models.keuangan import KasBank

def diagnose():
    db = SessionLocal()
    d = date(2026, 4, 21)
    txs = db.query(KasBank).filter(KasBank.tanggal == d, KasBank.tipe == "KELUAR", KasBank.sumber.in_(["JUAL_BELI_MOBIL"])).all()
    
    for t in txs:
        print(f"{t.sumber} | {t.nominal:,.2f} | {t.keterangan}")
    
    db.close()

if __name__ == "__main__":
    diagnose()
