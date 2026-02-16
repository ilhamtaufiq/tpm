import os
import sys

# Add backend to path
sys.path.append(r"c:\laragon\www\tpm\backend")

from app.database.session import SessionLocal
from app.models.bengkel import PembelianSparePart
from app.models.supplier import Supplier

db = SessionLocal()
try:
    print("--- Suppliers ---")
    for s in db.query(Supplier).all():
        print(f"ID: {s.id}, Name: {s.nama}")
        
    print("\n--- Purchase Transactions ---")
    for p in db.query(PembelianSparePart).all():
        s_name = p.supplier.nama if p.supplier else "NONE"
        print(f"ID: {p.id}, Trans: {p.nomor_transaksi}, Supplier_ID: {p.supplier_id}, Supplier_Name: {s_name}")
finally:
    db.close()
