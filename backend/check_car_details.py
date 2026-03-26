
import sys
import os

# Set current directory to backend
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.database import SessionLocal
from app.models.mobil import Mobil
from app.models.bengkel import TransaksiPenjualanBengkel
from app.utils.constants import CarStatus

def check_car_details():
    db = SessionLocal()
    try:
        car = db.query(Mobil).filter(Mobil.nomor_plat == "F 11 Z").first()
        if not car:
            print("Car not found")
            return
            
        print(f"Car: {car.merek} {car.model} ({car.nomor_plat})")
        print(f"Harga Beli: {car.harga_beli}")
        
        print("\nPart Services (direct link):")
        for p in car.part_services:
            print(f"- {p.deskripsi}: {p.total}")
            
        print("\nBengkel Perbaikan (workshop trans):")
        for t in car.bengkel_perbaikan:
            print(f"- {t.nomor_transaksi} ({t.kategori}): {t.grand_total}")
            
        print("\nBiaya Lainnya:")
        for b in car.biaya_lainnya:
            print(f"- {b.kategori}: {b.jumlah}")
            
        print(f"\nProperty total_part_service: {car.total_part_service}")
        print(f"Property total_biaya: {car.total_biaya}")
    finally:
        db.close()

if __name__ == "__main__":
    check_car_details()
