import sys
import os
from app.database.connection import SessionLocal
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
            if isinstance(val, dict) and "saldo" in val:
                # Format name for readability (e.g. kas_tunai -> Kas Tunai)
                display_name = key.replace("_", " ").title()
                print(f"{display_name:20}: Rp.{val['saldo']:,.2f}")
        print("-" * 30)
        print(f"{'TOTAL SEMUA SALDO':20}: Rp.{balances.get('total_saldo', 0):,.2f}")
        print("-" * 30)
    finally:
        db.close()

if __name__ == "__main__":
    check()
