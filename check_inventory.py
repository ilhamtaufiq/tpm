
import os
from sqlalchemy import create_all, select, func
from sqlalchemy.orm import Session
from app.database.session import SessionLocal
from app.models.mobil import Mobil
from app.utils.constants import CarStatus

def check_stok_mobil():
    db = SessionLocal()
    try:
        available_cars = (
            db.query(Mobil)
            .filter(Mobil.deleted_at.is_(None), Mobil.status != CarStatus.TERJUAL)
            .all()
        )
        
        print(f"Checking {len(available_cars)} unsold cars:")
        total_all = 0
        for car in available_cars:
            hb = float(car.harga_beli)
            tb = float(car.total_biaya)
            tps = float(car.total_part_service)
            total = hb + tb + tps
            total_all += total
            print(f"- {car.merek} {car.model} ({car.nomor_plat}):")
            print(f"  Harga Beli: {hb:,.2f}")
            print(f"  Total Biaya: {tb:,.2f}")
            print(f"  Total Part Service: {tps:,.2f}")
            print(f"  TOTAL: {total:,.2f}")
            
        print(f"\nGRAND TOTAL STOK MOBIL: {total_all:,.2f}")
    finally:
        db.close()

if __name__ == "__main__":
    check_stok_mobil()
