import sys
from decimal import Decimal
from sqlalchemy.orm import Session
from app.database.connection import SessionLocal
from app.models.mobil import Mobil
from app.utils.constants import CarStatus

def main():
    db = SessionLocal()
    try:
        mobil_available = db.query(Mobil).filter(
            Mobil.status != CarStatus.TERJUAL
        ).all()
        
        print(f"Total available cars: {len(mobil_available)}")
        for m in mobil_available:
            print(f"\nUnit: {m.merek} {m.model} ({m.nomor_plat})")
            print(f"  Harga Beli: {m.harga_beli}")
            print(f"  Total Biaya (HPP): {m.total_biaya}")
            print(f"  Total Part/Service (Excluded): {m.total_part_service}")
            
            # Breakdown Biaya Lainnya
            print("  Breakdown Biaya Lainnya:")
            for b in m.biaya_lainnya:
                print(f"    - [{b.kategori}] {b.deskripsi}: {b.jumlah}")
                
            # Breakdown Pengeluaran Bengkel
            print("  Breakdown Pengeluaran Bengkel:")
            for p in m.pengeluaran_bengkel:
                print(f"    - {p.deskripsi}: {p.jumlah}")
                
            # Breakdown Transaksi Bengkel
            print("  Breakdown Transaksi Bengkel:")
            for t in m.bengkel_perbaikan:
                print(f"    - {t.nomor_transaksi} ({t.kategori}): {t.grand_total}")

        stok_mobil_harga_beli = sum(m.harga_beli for m in mobil_available)
        stok_mobil_biaya = sum(m.total_biaya for m in mobil_available)
        stok_mobil_total = stok_mobil_harga_beli + stok_mobil_biaya
        
        print(f"\nFINAL CALCULATED STOK MOBIL (Inventory): {stok_mobil_total}")
        
    finally:
        db.close()

if __name__ == "__main__":
    main()
