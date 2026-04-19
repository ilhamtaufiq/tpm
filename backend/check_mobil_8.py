
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.database import SessionLocal
from app.models.mobil import Mobil

db = SessionLocal()
try:
    mobil = db.query(Mobil).get(8)
    if mobil:
        print(f"ID: {mobil.id}")
        print(f"Status: {mobil.status}")
        print(f"Deleted At: {mobil.deleted_at}")
    else:
        print("Mobil 8 not found.")
finally:
    db.close()
