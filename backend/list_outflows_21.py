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
    txs = db.query(KasBank).filter(KasBank.tanggal == d, KasBank.tipe == "KELUAR").all()
    
    print(f"Total entries: {len(txs)}")
    sources = {}
    for t in txs:
        sources[str(t.sumber)] = sources.get(str(t.sumber), 0) + float(t.nominal)
    for k, v in sources.items():
        print(f"{k}: {v:,.2f}")
    
    db.close()

if __name__ == "__main__":
    diagnose()
