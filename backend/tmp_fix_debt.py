import sys
import os
sys.path.append(os.getcwd())
from app.database.session import SessionLocal
from app.models.keuangan import HutangUsaha
from decimal import Decimal

db = SessionLocal()
try:
    hutangs = db.query(HutangUsaha).all()
    for h in hutangs:
        print(f"ID {h.id}: Nom={h.nominal_hutang} Paid={h.total_dibayar} Sisa={h.sisa_hutang} Status={h.status}")
        # Reconciliation: If Nom - Paid != Sisa, then Paid is likely missing original DP
        expected_sisa = h.nominal_hutang - h.total_dibayar
        if h.sisa_hutang != expected_sisa:
            print(f"  --> INCONSISTENT! Expected Sisa: {expected_sisa}")
            # The bug was that total_dibayar was 0 when it should have been Nom - Sisa
            # If sisa was set correctly but paid was 0
            if h.total_dibayar == 0 and h.sisa_hutang < h.nominal_hutang:
                print(f"  Fixing: setting total_dibayar to {h.nominal_hutang - h.sisa_hutang}")
                h.total_dibayar = h.nominal_hutang - h.sisa_hutang
                db.commit()
finally:
    db.close()
