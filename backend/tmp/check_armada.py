from app.database.connection import SessionLocal
from app.services.armada_service import ArmadaService
import json
from decimal import Decimal

db = SessionLocal()
service = ArmadaService(db)
res = service.get_detail(1)

print(f"Total Biaya Ops: {res['stats'].total_biaya_operasional}")
print(f"Workshop Expenses Count: {len(res['workshop_expenses'])}")
for we in res['workshop_expenses']:
    print(f"  - {we.nomor_transaksi}: {we.jumlah}")

db.close()
