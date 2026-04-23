from app.database import SessionLocal
from app.models.keuangan import KasBank
from app.utils.constants import KasBankType, KasBankSource
import json

db = SessionLocal()

# Outflows that are NOT recorded in specific tables
out = db.query(KasBank).filter(
    KasBank.tipe == KasBankType.KELUAR
).filter(
    KasBank.sumber.notin_([
        KasBankSource.PENGELUARAN, 
        KasBankSource.PEMBAYARAN_HUTANG if hasattr(KasBankSource, 'PEMBAYARAN_HUTANG') else KasBankSource.HUTANG,
        KasBankSource.PRIVE,
        KasBankSource.GAJI,
        KasBankSource.KASBON
    ])
).all()

print("Outflows not linked to Pengeluaran/Debt/Prive/Gaji/Kasbon:")
for r in out:
    # Only show if not a clear internal transfer (MUTASI)
    if r.sumber != KasBankSource.LAINNYA or r.nominal < 1000000: # LAINNYA > 1M usually transfer
         print(f"  {r.id} | {r.nominal} | {r.sumber.name} | {r.keterangan}")
