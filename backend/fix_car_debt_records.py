import sys
import os
from decimal import Decimal

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.connection import SessionLocal
from app.models.keuangan import HutangUsaha, HutangSource
from app.models.mobil import Mobil

def fix_existing_car_debts():
    db = SessionLocal()
    try:
        # Find car purchase debts where nominal is the full price but it was meant to be the remainder
        # We can detect this by checking if nominal_hutang == mobil.harga_beli 
        # AND sisa_hutang < nominal_hutang
        # AND total_dibayar > 0 (this total_dibayar is the DP that was incorrectly set)
        
        query = db.query(HutangUsaha).join(
            Mobil, HutangUsaha.nomor_referensi == Mobil.kode
        ).filter(
            HutangUsaha.sumber == HutangSource.PEMBELIAN_MOBIL,
            HutangUsaha.total_dibayar > 0,
            HutangUsaha.nominal_hutang == Mobil.harga_beli
        )
        
        affected_records = query.all()
        print(f"Found {len(affected_records)} affected records.")
        
        for hutang in affected_records:
            print(f"Fixing Hutang {hutang.nomor_hutang} (Ref: {hutang.nomor_referensi})")
            print(f"  Old Nominal: {hutang.nominal_hutang}, Total Dibayar (DP): {hutang.total_dibayar}, Sisa: {hutang.sisa_hutang}")
            
            # The fix: 
            # 1. Set nominal_hutang to the actual debt created (which is current nominal - initial DP)
            # 2. Set total_dibayar to 0 (since it should only track payments via PembayaranHutang table)
            
            dp_amount = hutang.total_dibayar
            hutang.nominal_hutang = hutang.nominal_hutang - dp_amount
            hutang.total_dibayar = Decimal("0")
            # sisa_hutang remains the same as it was already correct (price - DP)
            
            print(f"  New Nominal: {hutang.nominal_hutang}, Total Dibayar: {hutang.total_dibayar}, Sisa: {hutang.sisa_hutang}")
            
        if affected_records:
            confirm = input("Apply changes? (y/n): ")
            if confirm.lower() == 'y':
                db.commit()
                print("Changes committed.")
            else:
                print("Changes discarded.")
        else:
            print("No records need fixing.")
            
    except Exception as e:
        print(f"ERROR: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_existing_car_debts()
