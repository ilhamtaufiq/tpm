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
    
    for d in [date(2026, 4, 21), date(2026, 4, 22), date(2026, 5, 1)]:
        print(f"\n--- DIAGNOSTIC FOR {d} ---")
        r = service.get_report(d, d)
        print(f"Opening Modal (A1): {r['section_a']['initial_capital']:,.2f}")
        print(f"Setoran Modal: {r['section_a']['setoran_modal']:,.2f}")
        print(f"Period Profit: {r['section_a']['total_laba']:,.2f}")
        print(f"Total A: {r['section_a']['total_a']:,.2f}")
        print(f"Total C (Outflow): {r['section_c']['total_c']:,.2f}")
        print(f"Total D (Actual): {r['section_d']['total_d']:,.2f}")
        print(f"Theoretical: {r['section_d']['theoretical_modal']:,.2f}")
        print(f"Diff: {r['section_d']['penyesuaian']:,.2f}")

    db.close()

if __name__ == "__main__":
    diagnose()
