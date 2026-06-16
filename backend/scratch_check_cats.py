
import os
import sys
from decimal import Decimal
from datetime import date

sys.path.append(os.path.abspath(os.path.join(os.getcwd(), 'backend')))

from app.database.connection import SessionLocal
from app.models.bengkel import TransaksiPenjualanBengkel
from sqlalchemy import func

db = SessionLocal()
try:
    res = db.query(TransaksiPenjualanBengkel.kategori, func.sum(TransaksiPenjualanBengkel.grand_total)).group_by(TransaksiPenjualanBengkel.kategori).all()
    print("CATEGORIES:", res)
finally:
    db.close()
