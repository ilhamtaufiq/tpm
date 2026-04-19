
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.database import SessionLocal
from app.models.mobil import TransaksiPenjualanMobil

db = SessionLocal()
try:
    sale = db.query(TransaksiPenjualanMobil).get(3)
    if sale:
        print(f"Sale #3 Created At: {sale.created_at}")
    else:
        print("Sale #3 not found.")
finally:
    db.close()
