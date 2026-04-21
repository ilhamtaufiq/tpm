import sys
import os
sys.path.append(os.getcwd())

from app.db.session import SessionLocal
from app.services.kas_bank_service import KasBankService

def check():
    db = SessionLocal()
    try:
        service = KasBankService(db)
        balances = service.get_all_balances()
        print("-" * 30)
        print("SALDO DOMPET UNIT BISNIS")
        print("-" * 30)
        for key, val in balances.items():
            if isinstance(val, (int, float)):
                print(f"{key:20}: Rp.{val:,.2f}")
        print("-" * 30)
    finally:
        db.close()

if __name__ == "__main__":
    check()
