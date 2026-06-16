import os
import sys
import json
from datetime import date

# Add backend to path
sys.path.append('c:/laragon/www/tpm/backend')

from app.db.session import SessionLocal
from app.services.reports.modal_service import ModalService

def debug_report():
    db = SessionLocal()
    service = ModalService(db)
    
    # Check for 2026-04-28 to 2026-04-28 (Daily)
    # or 2026-04-01 to 2026-04-29
    tanggal_dari = date(2026, 4, 1)
    tanggal_sampai = date(2026, 4, 29)
    
    report = service.get_report(tanggal_dari, tanggal_sampai)
    
    print(json.dumps(report, indent=2))
    db.close()

if __name__ == "__main__":
    debug_report()
