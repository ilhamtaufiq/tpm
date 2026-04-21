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
    print(f"\n--- SECTION C BREAKDOWN FOR {d} ---")
    r = service.get_report(d, d)
    
    sc = r['section_c']
    for k, v in sc.items():
        if isinstance(v, dict):
             print(f"  - {k}: {v.get('total', 0) if 'total' in v else v}")
        else:
             print(f"  - {k}: {v:,.2f}")

    db.close()

if __name__ == "__main__":
    diagnose()
