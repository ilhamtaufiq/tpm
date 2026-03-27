import sys
import os
from datetime import datetime, date
import json

sys.path.insert(0, r"C:\laragon\www\tpm\backend")

from app.database.connection import SessionLocal
from app.models.mobil import Mobil, TransaksiPenjualanMobil

def run():
    db = SessionLocal()
    try:
        tanggal_dari = date(2024, 1, 1)
        tanggal_sampai = date(2026, 12, 31)
        result = get_neraca(db, tanggal_dari, tanggal_sampai)
        print(f"LABA BENGKEL: {result['modal']['detail_laba']['bengkel']}")
        print(f"LABA MOBIL: {result['modal']['detail_laba']['mobil']}")
        print(f"LABA JASA ANGKUT: {result['modal']['detail_laba']['jasa_angkut']}")
    finally:
        db.close()

if __name__ == "__main__":
    run()
