import os
import sys

# Add current directory to path
sys.path.append(os.path.abspath("."))

from app.database.session import SessionLocal
from app.models.jasa_angkut import ArmadaJasaAngkut, MuatanJasaAngkut
from app.utils.constants import MuatanStatus

db = SessionLocal()
try:
    armadas = db.query(ArmadaJasaAngkut).filter(ArmadaJasaAngkut.deleted_at.is_(None)).all()
    busy_trips = db.query(MuatanJasaAngkut).filter(MuatanJasaAngkut.status == MuatanStatus.PROSES).all()
    busy_ids = [m.armada_id for m in busy_trips if m.armada_id is not None]
    
    print("--- Armada List Status ---")
    for a in armadas:
        status_text = "BUSY" if a.id in busy_ids else "READY"
        active_text = "ACTIVE" if a.is_active else "INACTIVE"
        print(f"ID={a.id} | {a.nama} ({a.nopol}) | {active_text} | Status={status_text}")
        
    print("\n--- Busy Trips (PROSES) ---")
    if not busy_trips:
        print("No busy trips found.")
    for m in busy_trips:
        armada_info = f"ID={m.armada_id}"
        if m.armada:
            armada_info = f"{m.armada.nama} ({m.armada.nopol})"
        print(f"Muatan ID: {m.id} | No: {m.nomor_transaksi} | Date: {m.tanggal} | Armada: {armada_info}")

finally:
    db.close()
