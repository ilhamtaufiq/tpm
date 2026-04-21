import sys
import os
from datetime import date
from app.database.connection import SessionLocal
from app.services.reports.base import BaseReportService

def debug():
    db = SessionLocal()
    try:
        service = BaseReportService(db)
        today = date.today()
        first_of_month = today.replace(day=1)
        summary = service.get_unit_financial_breakdown(first_of_month, today)
        
        print("-" * 50)
        print(f"OVERHEAD & UNIT PROFIT DEBUG")
        print("-" * 50)
        print(f"Total Overhead Umum: Rp.{summary['total_overhead_umum']:,.2f}")
        
        for unit_name, data in summary['units'].items():
            print(f"\nUNIT: {unit_name.upper()}")
            if unit_name == 'bengkel':
                print(f"  Laba Kotor     : Rp.{data['laba_kotor']:,.2f}")
                print(f"  Expenses       : Rp.{data['total_expenses']:,.2f}")
                print(f"  Gaji           : Rp.{data['gaji']:,.2f}")
            elif unit_name == 'mobil':
                print(f"  Laba Kantor    : Rp.{data['total_laba_tpm']:,.2f}")
            elif unit_name == 'jasa_angkut':
                print(f"  Laba Kantor    : Rp.{data['total_laba_tpm']:,.2f}")
        
        print("-" * 50)
    finally:
        db.close()

if __name__ == "__main__":
    debug()
