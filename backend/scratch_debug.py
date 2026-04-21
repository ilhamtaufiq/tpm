import sys
import os
from datetime import date
from decimal import Decimal

# Add current directory to path
sys.path.append(os.getcwd())

from app.database.connection import SessionLocal
from app.models.mobil import TransaksiPenjualanMobil, Mobil

db = SessionLocal()

print("--- Mobil Transactions ---")
trans = db.query(TransaksiPenjualanMobil).all()
for t in trans:
    print(f"No: {t.nomor_transaksi}, Tanggal: {t.tanggal}, Jual: {t.harga_jual}, Laba TPM: {t.laba_tpm}")

print("\n--- Mobil Inventory ---")
mobils = db.query(Mobil).all()
for m in mobils:
    print(f"ID: {m.id}, Merek: {m.merek}, Status: {m.status}, Harga Beli: {m.harga_beli}")

db.close()
