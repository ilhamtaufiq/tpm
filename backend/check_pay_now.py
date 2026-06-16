from app.database import SessionLocal
from app.models.keuangan import PembayaranPiutang
db = SessionLocal()
pay = db.query(PembayaranPiutang).filter(PembayaranPiutang.tanggal == '2026-03-31').all()
print("PembayaranPiutang Today:")
for p in pay:
    print(f"ID: {p.id} | {float(p.nominal):,.2f} | Method: {p.metode_bayar} | Cat: {p.catatan}")
