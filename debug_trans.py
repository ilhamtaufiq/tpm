import sys
import os
sys.path.append(r"c:\laragon\www\tpm\backend")
from app.database.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    res = db.execute(text("SELECT id, nomor_transaksi, supplier_id FROM pembelian_spare_parts WHERE nomor_transaksi = 'PBL2602150001'")).first()
    if res:
        print(f"Record: {res}")
        s = db.execute(text(f"SELECT id, nama FROM suppliers WHERE id = {res.supplier_id}")).first()
        print(f"Supplier in DB: {s}")
    else:
        print("Record not found")
finally:
    db.close()
