
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.database import SessionLocal
from app.models.mobil import Mobil, TransaksiPenjualanMobil

db = SessionLocal()
try:
    mobil_id = 8
    mobil = db.query(Mobil).filter(Mobil.id == mobil_id).first()
    if not mobil:
        print(f"Mobil with ID {mobil_id} not found.")
    else:
        print(f"Mobil: {mobil.kode} - {mobil.nomor_plat} - Status: {mobil.status}")
        
    sale = db.query(TransaksiPenjualanMobil).filter(TransaksiPenjualanMobil.mobil_id == mobil_id).first()
    if sale:
        print(f"Sale Transaction Found: {sale.nomor_transaksi} (ID: {sale.id}) - Total Modal: {sale.total_modal}")
    else:
        print("No Sale Transaction found for this car ID.")
finally:
    db.close()
