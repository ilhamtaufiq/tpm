import sys
import os
sys.path.append(os.getcwd())

from app.database.connection import SessionLocal
from app.models.bengkel import TransaksiPenjualanBengkel
from app.models.jasa_angkut import MuatanJasaAngkut
from sqlalchemy import func

db = SessionLocal()
print(f"Total Transaksi Bengkel: {db.query(func.count(TransaksiPenjualanBengkel.id)).scalar()}")
print(f"Total Muatan Jasa Angkut: {db.query(func.count(MuatanJasaAngkut.id)).scalar()}")

db.close()
