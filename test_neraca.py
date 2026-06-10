import sys
import os
sys.path.append(r"c:\laragon\www\tpm\backend")
from datetime import date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.services.reports.neraca_service import NeracaService
from app.db.session import SessionLocal

db = SessionLocal()
try:
    service = NeracaService(db)
    report = service.get_report(date.today())
    print(f"Is Balanced: {report['is_balanced']}")
    print(f"Selisih: {report['selisih']}")
    print(f"Aktiva: {report['total_aktiva']}")
    print(f"Pasiva: {report['total_pasiva']}")
finally:
    db.close()
