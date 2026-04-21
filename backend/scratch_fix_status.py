
import os
import sys
from decimal import Decimal
from datetime import date

sys.path.append(os.path.abspath(os.path.join(os.getcwd(), 'backend')))

from app.database.connection import SessionLocal
from app.models.mobil import Mobil
from app.services.penjualan_mobil_service import PenjualanMobilService

db = SessionLocal()
try:
    # Find cars that are SOLD
    sold_car = db.query(Mobil).filter(Mobil.status == 'terjual').order_by(Mobil.updated_at.desc()).first()
    if sold_car:
        print(f"Cleaning up financial obligations for Mobil: {sold_car.nomor_plat} (ID: {sold_car.id})")
        service = PenjualanMobilService(db)
        service._settle_unit_financial_obligations(sold_car, date.today(), "FORCE-SETTLE-DEBUG")
        db.commit()
        print("Done! Status should be LUNAS now.")
    else:
        print("No sold car found to clean.")
finally:
    db.close()
