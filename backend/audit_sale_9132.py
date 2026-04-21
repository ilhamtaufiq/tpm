import sys
import os
from app.database.connection import SessionLocal
from app.models.mobil import Mobil, TransaksiPenjualanMobil
from app.models.bengkel import PengeluaranBengkel

def audit():
    db = SessionLocal()
    try:
        m = db.query(Mobil).filter(Mobil.nomor_plat.like('%9132%')).first()
        if not m:
            print("Mobil tidak ditemukan")
            return
            
        tx = db.query(TransaksiPenjualanMobil).filter(TransaksiPenjualanMobil.mobil_id == m.id).first()
        
        print("-" * 50)
        print(f"AUDIT MOBIL: {m.nomor_plat} ({m.merek} {m.model})")
        print("-" * 50)
        print(f"Harga Beli      : Rp.{m.harga_beli:,.2f}")
        print(f"Total Modal (DB): Rp.{m.total_modal:,.2f}")
        
        if tx:
            print(f"Harga Jual      : Rp.{tx.harga_jual:,.2f}")
            print(f"Laba Kotor      : Rp.{tx.laba_kotor:,.2f}")
            print(f"Laba TPM        : Rp.{tx.laba_tpm:,.2f}")
            print(f"Laba Investor   : Rp.{tx.laba_investor:,.2f}")
            print(f"Nominal Cair    : Rp.{tx.nominal_pencairan:,.2f}")
        
        print("\nDETAIL BIAYA PERBAIKAN / PREP:")
        costs = db.query(PengeluaranBengkel).filter(PengeluaranBengkel.mobil_id == m.id).all()
        total_p = 0
        for c in costs:
            print(f"  - {c.deskripsi:30}: Rp.{c.jumlah:,.2f} ({c.bisnis_kategori}, {c.metode_bayar})")
            total_p += c.jumlah
        print(f"TOTAL BIAYA LEDGER: Rp.{total_p:,.2f}")
        print("-" * 50)

    finally:
        db.close()

if __name__ == "__main__":
    audit()
