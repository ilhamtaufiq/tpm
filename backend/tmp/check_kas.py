import os
import sys

# Add backend directory to path
sys.path.append('c:/laragon/www/tpm/backend')

from app.db.session import SessionLocal
from app.models.keuangan import KasBank
from app.utils.constants import KasBankJenis, KasBankType, KasBankSource

db = SessionLocal()
kas = db.query(KasBank).filter(KasBank.tanggal == '2026-03-31').all()

print("KasBank History Today:")
for k in kas:
    print(f"ID: {k.id} | {k.tipe} | {float(k.nominal):,.2f} | Source: {k.sumber} | Jenis: {k.jenis} | Ket: {k.keterangan}")
