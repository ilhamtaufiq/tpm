import os
from dotenv import load_dotenv
load_dotenv()
from app.database import SessionLocal
from app.models.mobil import Mobil, TransaksiPenjualanMobil, MobilBiayaLainnya
from app.models.bengkel import TransaksiPenjualanBengkel

db = SessionLocal()
tx = db.query(TransaksiPenjualanMobil).order_by(TransaksiPenjualanMobil.id.desc()).first()
if tx:
    m = tx.mobil
    print(f"Mobil: {m.model} ({m.nomor_plat})")
    print(f"Harga Beli: {m.harga_beli}")
    print(f"Total Modal di TX: {tx.total_modal}")
    
    print("\n--- MobilBiayaLainnya ---")
    for b in m.biaya_lainnya:
        print(f"{b.kategori}: {b.jumlah} ({b.deskripsi})")
        
    print("\n--- PengeluaranBengkel (Linked to Mobil) ---")
    for p in m.pengeluaran_bengkel:
        print(f"Kategori: {p.kategori}, Total: {p.jumlah}, Ket: {p.deskripsi}")
        
    print("\n--- TransaksiPenjualanBengkel (Linked to Mobil) ---")
    from app.models.bengkel import TransaksiPenjualanBengkel
    ws_sales = db.query(TransaksiPenjualanBengkel).filter(TransaksiPenjualanBengkel.mobil_id == m.id).all()
    for s in ws_sales:
        print(f"ID:{s.id}, Total:{s.grand_total}, Status:{s.status_bayar}")
else:
    print("No Transaction Found")
db.close()
