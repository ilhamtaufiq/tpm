import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db.database import SessionLocal
from services.muatan_service import MuatanService
from services.penjualan_mobil_service import PenjualanMobilService

db = SessionLocal()
s1 = MuatanService(db)
summ1 = s1.get_summary()

print("BIAYA BENGKEL JA:", summ1.get("details", {}).get("biaya_bengkel"))
print("BENGKEL ARMADA:", summ1.get("details", {}).get("bengkel_per_armada"))

s2 = PenjualanMobilService(db)
summ2 = s2.get_summary()
print("BIAYA BENGKEL MOBIL:", summ2.get("total_biaya_bengkel"))
print("BENGKEL PER MOBIL:", summ2.get("bengkel_per_mobil"))
