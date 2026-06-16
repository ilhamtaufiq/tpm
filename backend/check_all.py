
import sys
import os

# Set current directory to backend
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.database import SessionLocal
from app.models.mobil import Mobil
from app.utils.constants import CarStatus

def check_all_cars_total():
    db = SessionLocal()
    try:
        available_cars = (
            db.query(Mobil)
            .filter(Mobil.deleted_at.is_(None))
            .all()
        )
        
        print(f"Checking {len(available_cars)} cars:")
        for car in available_cars:
            try:
                hb = float(car.harga_beli or 0)
                tb = float(car.total_biaya or 0)
                tps = float(car.total_part_service or 0)
                print(f"- {car.nomor_plat}: {hb} + {tb} + {tps} = {hb+tb+tps}")
            except Exception as e:
                print(f"FAILED for {car.nomor_plat}: {e}")
                
    finally:
        db.close()

if __name__ == "__main__":
    check_all_cars_total()
