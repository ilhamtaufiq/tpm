from app.database import SessionLocal
from app.services.reports.neraca_service import NeracaService
from datetime import date
import json

db = SessionLocal()
service = NeracaService(db)
# Use today's date
report = service.get_report(date(2026, 4, 22))

print(json.dumps(report, indent=2))
