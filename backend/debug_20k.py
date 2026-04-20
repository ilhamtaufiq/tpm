from app.db.session import SessionLocal
from app.models.keuangan import KasBank
from app.utils.constants import KasBankSource, KasBankType
import json

db = SessionLocal()
res = db.query(KasBank).filter(KasBank.nominal == 20000).all()
out = []
for r in res:
    out.append({
        "id": r.id,
        "keterangan": r.keterangan,
        "sumber": r.sumber.value if hasattr(r.sumber, 'value') else str(r.sumber),
        "tipe": r.tipe.value if hasattr(r.tipe, 'value') else str(r.tipe),
        "tanggal": str(r.tanggal)
    })
print(json.dumps(out, indent=2))
