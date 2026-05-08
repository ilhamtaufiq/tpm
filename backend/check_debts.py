from app.database.connection import SessionLocal
from app.models.keuangan import HutangUsaha, HutangSource
from app.models.mobil import Mobil

print('Starting check...')
db = SessionLocal()
print('Querying...')
results = db.query(HutangUsaha).all()
print(f'Found {len(results)} records.')
for h in results:
    print(f'ID: {h.id}, Ref: {h.nomor_referensi}, Nom: {h.nominal_hutang}, Paid: {h.total_dibayar}, Sisa: {h.sisa_hutang}')
db.close()
