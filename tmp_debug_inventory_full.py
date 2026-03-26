import sys
from decimal import Decimal
from sqlalchemy.orm import Session
from app.database.connection import SessionLocal
from app.models.mobil import Mobil
from app.utils.constants import CarStatus

def main():
    db = SessionLocal()
    try:
        all_cars = db.query(Mobil).all()
        
        print(f"Total cars in DB: {len(all_cars)}")
        for m in all_cars:
            print(f"\nID: {m.id} | Unit: {m.merek} {m.model} ({m.nomor_plat})")
            print(f"  Status: {m.status}")
            print(f"  Harga Beli: {m.harga_beli}")
            print(f"  Total Biaya (HPP): {m.total_biaya}")
            print(f"  Total Part/Service (Excluded): {m.total_part_service}")
            
            # Breakdown Biaya Lainnya
            print("  Breakdown Biaya Lainnya:")
            if m.biaya_lainnya:
                for b in m.biaya_lainnya:
                    print(f"    - [{b.kategori}] {b.deskripsi}: {b.jumlah}")
            else:
                print("    (None)")
                
        mobil_available = [m for m in all_cars if m.status != CarStatus.TERJUAL]
        stok_mobil_harga_beli = sum(m.harga_beli for m in mobil_available)
        stok_mobil_biaya = sum(m.total_biaya for m in mobil_available)
        stok_mobil_total = stok_mobil_harga_beli + stok_mobil_biaya
        
        print(f"\nAVAILABLE CARS: {len(mobil_available)}")
        print(f"FINAL CALCULATED STOK MOBIL (Inventory): {stok_mobil_total}")
        
    finally:
        db.close()

if __name__ == "__main__":
    main()
