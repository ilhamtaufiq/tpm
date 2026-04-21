from app.database.session import SessionLocal
from app.models.mobil import Mobil, TransaksiPenjualanMobil, MobilBiayaLainnya
from app.models.bengkel import PengeluaranBengkel
from sqlalchemy import func
from decimal import Decimal

db = SessionLocal()

# 1. Look for Kijang sale today
kijang = db.query(Mobil).filter(Mobil.model.ilike("%Kijang%")).first()
if kijang:
    print(f"Mobil: {kijang.merek} {kijang.model} ({kijang.nomor_plat})")
    print(f"Harga Beli: {kijang.harga_beli}")
    print(f"Tanggal Terjual: {kijang.tanggal_terjual}")
    
    sale = kijang.penjualan
    if sale:
        print(f"--- Penjualan ---")
        print(f"Tanggal: {sale.tanggal}")
        print(f"Harga Jual: {sale.harga_jual}")
        print(f"HPP (Saved in Transaction): {sale.total_modal}")
        print(f"Laba TPM (Saved in Transaction): {sale.laba_tpm}")
    
    # 2. Look for expenses today
    expenses = db.query(PengeluaranBengkel).filter(
        PengeluaranBengkel.mobil_id == kijang.id,
        PengeluaranBengkel.tanggal == kijang.tanggal_terjual # Today
    ).all()
    
    print(f"--- Expenses Today for this Car ---")
    for e in expenses:
        print(f"- {e.deskripsi}: {e.jumlah} (At: {e.created_at})")

db.close()
