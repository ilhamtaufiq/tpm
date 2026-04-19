import sys
import datetime
sys.path.append('c:\\laragon\\www\\tpm\\backend')
from app.database import SessionLocal
from app.services.kas_bank_integration import create_kas_entry
from app.utils.constants import KasBankType, KasBankSource, PaymentMethod

db = SessionLocal()
try:
    create_kas_entry(
        db=db, 
        tanggal=datetime.date(2026, 4, 19), 
        tipe=KasBankType.KELUAR, 
        nominal=100000, 
        sumber=KasBankSource.JUAL_BELI_MOBIL, 
        metode_bayar=PaymentMethod.INTERNAL, 
        referensi_id=None, 
        nomor_referensi='MBL2604190001', 
        keterangan='Pelunasan Biaya Repair Internal (Manual Correction)', 
        user_id=1, 
        allow_negative=True
    )
    print("Manual fix successful")
except Exception as e:
    print(f"Manual fix failed: {e}")
finally:
    db.close()
