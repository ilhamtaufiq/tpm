from app.database import SessionLocal
from app.models.keuangan import KasBank
from app.utils.constants import KasBankSource, KasBankType
import json

db = SessionLocal()
# Looking for anything around 20,000 for the last few days
res = db.query(KasBank).filter(KasBank.nominal >= 15000, KasBank.nominal <= 25000).filter(KasBank.tanggal >= "2026-04-15").all()
out = []
for r in res:
    out.append({
        "id": r.id,
        "keterangan": r.keterangan,
        "sumber": r.sumber.name if hasattr(r.sumber, 'name') else str(r.sumber),
        "tipe": r.tipe.name if hasattr(r.tipe, 'name') else str(r.tipe),
        "nominal": float(r.nominal),
        "tanggal": str(r.tanggal)
    })
print(json.dumps(out, indent=2))
