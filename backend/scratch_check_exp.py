
import os
import sys
from decimal import Decimal
from datetime import date

sys.path.append(os.path.abspath(os.path.join(os.getcwd(), 'backend')))

from app.database.connection import SessionLocal
from app.models.bengkel import PengeluaranBengkel
from sqlalchemy import func

db = SessionLocal()
try:
    res = db.query(PengeluaranBengkel.deskripsi, PengeluaranBengkel.jumlah, PengeluaranBengkel.bisnis_kategori).all()
    print("EXPENSES:", res)
finally:
    db.close()
