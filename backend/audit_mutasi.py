import sys
import os
from app.database.connection import SessionLocal
from app.services.kas_bank_service import KasBankService

def audit():
    db = SessionLocal()
    try:
        service = KasBankService(db)
        txs = service.get_list(limit=50)
        print("-" * 100)
        print(f"{'DATE':12} | {'TYPE':6} | {'UNIT':20} | {'AMOUNT':15} | {'DESC'}")
        print("-" * 100)
        for t in txs['data']:
            print(f"{str(t.tanggal):12} | {t.tipe:6} | {t.jenis.value:20} | {t.nominal:15,.2f} | {t.keterangan}")
        print("-" * 100)
    finally:
        db.close()

if __name__ == "__main__":
    audit()
