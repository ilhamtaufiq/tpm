import os
import sys
from sqlalchemy import func

# Set up current directory to import app
sys.path.append(os.getcwd())

from app.database import SessionLocal
from app.models.bengkel import PengeluaranBengkel
from app.models.keuangan import KasBank

def check_kas_entries():
    db = SessionLocal()
    try:
        ids = [14, 15, 16]
        print(f"--- Checking KasBank entries for Pengeluaran IDs: {ids} ---")
        
        for pid in ids:
            p = db.query(PengeluaranBengkel).filter(PengeluaranBengkel.id == pid).first()
            if not p:
                print(f"Pengeluaran {pid} not found")
                continue
                
            kas = db.query(KasBank).filter(
                KasBank.referensi_id == p.id,
                KasBank.nomor_referensi == p.nomor_transaksi
            ).all()
            
            print(f"\nPengeluaran ID: {p.id}")
            print(f"Kategori Bisnis: {p.bisnis_kategori}")
            print(f"Deskripsi: {p.deskripsi}")
            print(f"Jumlah: {p.jumlah}")
            
            if not kas:
                print("No KasBank entry found!")
            for k in kas:
                print(f"  KasBank ID: {k.id}, Akun: {k.jenis}, Nominal: {k.nominal}, Keterangan: {k.keterangan}")
                
    finally:
        db.close()

if __name__ == "__main__":
    check_kas_entries()
