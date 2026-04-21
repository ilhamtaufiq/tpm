
import sys
import os
sys.path.append(os.getcwd() + '/backend')
from app.database.session import SessionLocal
from app.models.keuangan import PiutangUsaha
from sqlalchemy import or_

db = SessionLocal()
try:
    results = db.query(PiutangUsaha).order_by(PiutangUsaha.id.desc()).limit(20).all()
    print("ID | Debitur | Sumber | Sisa | Status")
    print("-" * 60)
    for r in results:
        print(f"{r.id} | {r.nama_debitur} | {r.sumber.value} | {r.sisa_piutang} | {r.status.value}")
finally:
    db.close()
