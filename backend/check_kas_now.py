from app.database import SessionLocal
from app.models.keuangan import KasBank
db = SessionLocal()
kas = db.query(KasBank).filter(KasBank.nomor_referensi == 'PTG2603310001').all()
print("KasBank for PTG2603310001:")
for k in kas:
    print(f"ID: {k.id} | {k.tanggal} | {float(k.nominal):,.2f} | Ket: {k.keterangan}")
