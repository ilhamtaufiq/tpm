import sys
import os
sys.path.append(os.getcwd())

from app.db.session import SessionLocal
from app.models.keuangan import KasBank
from datetime import date

db = SessionLocal()
start_may = date(2026, 5, 1) # assuming May from previous context
end_may = date(2026, 5, 31)

print("Searching for 160000 in May 2026...")
kas = db.query(KasBank).filter(
    KasBank.nominal == 160000,
    KasBank.tanggal >= start_may,
    KasBank.tanggal <= end_may
).all()

for k in kas:
    print(f"Found: {k.keterangan}, Wallet: {k.jenis}, Tipe: {k.tipe}, Date: {k.tanggal}, Source: {k.sumber}")

db.close()
