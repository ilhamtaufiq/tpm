import os
import sys
from sqlalchemy import func

# Set up current directory to import app
sys.path.append(os.getcwd())

from app.database import SessionLocal
from app.models.bengkel import PengeluaranBengkel

def debug_mobil_expenses():
    db = SessionLocal()
    try:
        units = ["penjualan_mobil", "jual_beli_mobil", "mobil"]
        
        print(f"--- Breakdown for categories: {units} ---")
        
        # Aggregate totals per unit
        totals = db.query(
            PengeluaranBengkel.bisnis_kategori,
            func.sum(PengeluaranBengkel.jumlah)
        ).filter(
            PengeluaranBengkel.bisnis_kategori.in_(units)
        ).group_by(PengeluaranBengkel.bisnis_kategori).all()
        
        for unit, total in totals:
            print(f"Unit: {unit}, Total: {total:,.2f}")
            
        print("\n--- Detailed Records for these categories ---")
        records = db.query(PengeluaranBengkel).filter(
            PengeluaranBengkel.bisnis_kategori.in_(units)
        ).order_by(PengeluaranBengkel.tanggal.desc()).all()
        
        for r in records:
            print(f"ID: {r.id}, Kategori: {r.bisnis_kategori}, Deskripsi: {r.deskripsi}, Jumlah: {r.jumlah:,.2f}, Tanggal: {r.tanggal}")
            
    finally:
        db.close()

if __name__ == "__main__":
    debug_mobil_expenses()
