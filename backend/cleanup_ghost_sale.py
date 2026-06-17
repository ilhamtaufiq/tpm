
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.database import SessionLocal
from app.models.mobil import Mobil, TransaksiPenjualanMobil
from app.utils.constants import CarStatus

db = SessionLocal()
try:
    # 1. Sale #3 is incomplete (no kas entries)
    sale = db.query(TransaksiPenjualanMobil).get(3)
    if sale:
        print(f"Deleting Ghost Sale #3 (Nomor: {sale.nomor_transaksi})")
        db.delete(sale)
    
    # 2. Ensure Mobil #8 is back to TERSEDIA
    mobil = db.query(Mobil).get(8)
    if mobil:
        print(f"Resetting Mobil #8 status to TERSEDIA")
        mobil.status = CarStatus.TERSEDIA
        mobil.tanggal_terjual = None
        mobil.harga_jual = 0
    
    db.commit()
    print("Cleanup successful.")
except Exception as e:
    db.rollback()
    print(f"Cleanup failed: {e}")
finally:
    db.close()
