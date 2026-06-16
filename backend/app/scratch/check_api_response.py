import sys
import os
from datetime import date
import json
from decimal import Decimal

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.database.connection import SessionLocal
from app.api.v1.dashboard import get_profit_summary

# Custom JSON encoder for Decimals
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, obj).default(obj)

db = SessionLocal()
# Month range: April 2026
dari = date(2026, 4, 1)
sampai = date(2026, 4, 30)

print(f"--- SIMULATING DASHBOARD FOR {dari} to {sampai} ---")
results = get_profit_summary(db, dari, sampai)

# Print specific parts we care about
print("\n[MOBIL DETAILS]")
print(json.dumps(results.get("mobil_details"), indent=2, cls=DecimalEncoder))

print("\n[PENGELUARAN UNIT DETAILS]")
print(json.dumps(results.get("pengeluaran_unit_details"), indent=2, cls=DecimalEncoder))

db.close()
