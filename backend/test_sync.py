import sys
import os
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.database.connection import SessionLocal
from app.services.reports.neraca_service import NeracaService

db = SessionLocal()
s = NeracaService(db)
print(s.sync_internal_transactions(1))
