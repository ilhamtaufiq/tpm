
import sys
import os
from datetime import date
from decimal import Decimal

# Add the project root to sys.path
sys.path.append(os.getcwd())

from app.database.connection import SessionLocal
from app.models.keuangan import KasBank
from app.services.kas_bank_integration import create_kas_entry
from app.utils.constants import KasBankType, KasBankSource, PaymentMethod

def fix_internal_payment():
    db = SessionLocal()
    try:
        # Check if it already exists to avoid double entry
        existing = db.query(KasBank).filter(
            KasBank.nomor_referensi == "BGL2602210001",
            KasBank.tipe == KasBankType.KELUAR
        ).first()
        
        if existing:
            print("Fix already applied.")
            return

        # Create the missing KELUAR entry via official helper
        create_kas_entry(
            db=db,
            tanggal=date(2026, 2, 21),
            tipe=KasBankType.KELUAR,
            nominal=Decimal("115000.00"),
            sumber=KasBankSource.JASA_ANGKUT,
            metode_bayar=PaymentMethod.INTERNAL,
            referensi_id=2, # the bengkel trans id
            nomor_referensi="BGL2602210001",
            keterangan="Biaya Repair Internal via Bengkel: BGL2602210001 (Manual Fix)",
            user_id=1 # System/Admin
        )
        
        db.commit()
        print("Successfully added missing KELUAR entry for internal repair.")
        
    finally:
        db.close()

if __name__ == "__main__":
    fix_internal_payment()
