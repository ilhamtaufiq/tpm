import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import asyncio
from datetime import date
from app.database.connection import SessionLocal
from app.services.reports.neraca_service import NeracaService

def test():
    db = SessionLocal()
    try:
        res = NeracaService(db).get_report(date(2026, 5, 5))
        print(f"Aktiva: {res['total_aktiva']:,.2f}")
        print(f"Pasiva: {res['total_pasiva']:,.2f}")
        print(f"Selisih: {res['selisih']:,.2f}")
        print("Mismatches:", res["cross_validation"]["mismatches"])
        print("Modal Non-Kas:", res["modal"]["modal_non_kas"])
    finally:
        db.close()

if __name__ == "__main__":
    test()
