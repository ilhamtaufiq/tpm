
import sys
import os
sys.path.append(os.getcwd() + '/backend')
from app.database.session import SessionLocal
from app.models.keuangan import KasBank
from sqlalchemy import or_

db = SessionLocal()
try:
    results = db.query(KasBank).filter(or_(KasBank.nominal == 200000, KasBank.nominal == -200000)).order_by(KasBank.id.desc()).limit(10).all()
    print("ID | Tanggal | Nominal | Sumber | Keterangan")
    print("-" * 60)
    for r in results:
        print(f"{r.id} | {r.tanggal} | {r.nominal} | {r.sumber.value} | {r.keterangan}")
finally:
    db.close()
