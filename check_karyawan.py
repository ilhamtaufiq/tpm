
import sys
import os
from decimal import Decimal

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.database.session import SessionLocal
from app.models.karyawan import Karyawan

def check_karyawan():
    db = SessionLocal()
    try:
        karyawan = db.query(Karyawan).filter(Karyawan.kode == "KRY26020004").first()
        if karyawan:
            print(f"ID: {karyawan.id}")
            print(f"Nama: {karyawan.nama}")
            print(f"Gaji Pokok: {karyawan.gaji_pokok}")
        else:
            print("Karyawan not found")
    finally:
        db.close()

if __name__ == "__main__":
    check_karyawan()
