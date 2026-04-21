import os
import sys
from datetime import date, timedelta

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

from app.database.connection import SessionLocal
from app.services.reports.modal_service import ModalService

def diagnose():
    db = SessionLocal()
    service = ModalService(db)
    
    d = date(2026, 4, 21)
    print(f"\n--- DETAILED DIAGNOSTIC FOR {d} ---")
    r = service.get_report(d, d)
    
    print(f"Total A: {r['section_a']['total_a']:,.2f}")
    print(f"Total B (Assets): {r['section_b']['total_b']:,.2f}")
    for k, v in r['section_b'].items():
        if k != 'total_b':
            print(f"  - {k}: {v:,.2f}")
            
    print(f"Total C (Outflow): {r['section_c']['total_c']:,.2f}")
    print(f"Total E (Liabilities): {r['section_e']['total_e']:,.2f}")
    print(f"Theoretical (A - B + E): {r['section_d']['theoretical_modal']:,.2f}")
    print(f"Actual Cash: {r['section_d']['total_d']:,.2f}")
    print(f"Difference: {r['section_d']['penyesuaian']:,.2f}")

    db.close()

if __name__ == "__main__":
    diagnose()
