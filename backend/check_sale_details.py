
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.database import SessionLocal
from app.models.mobil import Mobil, TransaksiPenjualanMobil

db = SessionLocal()
try:
    sale = db.query(TransaksiPenjualanMobil).get(3)
    if sale:
        print(f"Sale #3 Details:")
        print(f"Nomor: {sale.nomor_transaksi}")
        print(f"Tanggal: {sale.tanggal}")
        print(f"Mobil ID: {sale.mobil_id}")
        print(f"Grand Total: {sale.harga_jual}")
    else:
        print("Sale #3 not found.")
finally:
    db.close()
