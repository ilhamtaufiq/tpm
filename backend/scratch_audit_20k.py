from app.database import SessionLocal
from app.models.keuangan import KasBank
from app.models.bengkel import PengeluaranBengkel
from app.utils.constants import KasBankType, KasBankSource
from sqlalchemy import func
import json

db = SessionLocal()

# Check for specific 20k transactions
txs = db.query(KasBank).filter(KasBank.nominal == 20000).all()
print("Transactions of 20,000:")
for t in txs:
    print(f"  {t.id} | {t.tanggal} | {t.tipe.name} | {t.sumber.name} | {t.keterangan}")

# Check for unrecorded outflows (sumber=LAINNYA or others that don't hit ledger)
untracked = db.query(KasBank).filter(
    KasBank.tipe == KasBankType.KELUAR,
    KasBank.sumber == KasBankSource.LAINNYA
).all()
print("\nUntracked outflows (sumber=LAINNYA):")
for t in untracked:
    print(f"  {t.id} | {t.nominal} | {t.keterangan}")
