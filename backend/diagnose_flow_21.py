import os
import sys
from datetime import date, timedelta

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

from app.database.connection import SessionLocal
from app.models.keuangan import KasBank
from sqlalchemy import func

def diagnose():
    db = SessionLocal()
    d = date(2026, 4, 21)
    masuk = db.query(func.sum(KasBank.nominal)).filter(KasBank.tanggal == d, KasBank.tipe == "MASUK").scalar() or 0
    keluar = db.query(func.sum(KasBank.nominal)).filter(KasBank.tanggal == d, KasBank.tipe == "KELUAR").scalar() or 0
    
    print(f"April 21 Masuk: {masuk:,.2f}")
    print(f"April 21 Keluar: {keluar:,.2f}")
    print(f"Net Flow: {(masuk - keluar):,.2f}")
    
    db.close()

if __name__ == "__main__":
    diagnose()
