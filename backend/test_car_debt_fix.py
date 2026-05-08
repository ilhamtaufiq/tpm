import sys
import os
from decimal import Decimal
from datetime import date

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.connection import SessionLocal
from app.services.mobil_service import MobilService
from app.schemas.mobil import MobilCreate
from app.utils.constants import PaymentStatus, PaymentMethod, OwnershipType, CarStatus, HutangSource
from app.models.keuangan import HutangUsaha, KasBank
from app.services.reports.neraca_service import NeracaService

def test_car_purchase_debt():
    db = SessionLocal()
    service = MobilService(db)
    
    # Test data
    price = Decimal("1000000")
    dp = Decimal("200000")
    expected_debt = price - dp
    
    # Unique plate to avoid conflicts
    import random
    plate = f"TEST{random.randint(1000, 9999)}"
    
    data = MobilCreate(
        merek="Toyota",
        model="Camry",
        tahun=2020,
        warna="Putih",
        nomor_plat=plate,
        harga_beli=price,
        tanggal_masuk=date.today(),
        status_bayar=PaymentStatus.CICILAN,
        dp=dp,
        metode_bayar=PaymentMethod.TUNAI
    )
    
    print(f"Creating car with Price: {price}, DP: {dp}...")
    
    try:
        # Create car
        mobil = service.create(data)
        print(f"Car created with ID: {mobil.id}, Kode: {mobil.kode}")
        
        # 1. Check HutangUsaha record directly
        hutang = db.query(HutangUsaha).filter(
            HutangUsaha.nomor_referensi == mobil.kode,
            HutangUsaha.sumber == HutangSource.PEMBELIAN_MOBIL
        ).first()
        
        if not hutang:
            print("FAILED: HutangUsaha record not found!")
            return
            
        print(f"Hutang Record - Nominal: {hutang.nominal_hutang}, Sisa: {hutang.sisa_hutang}, Paid: {hutang.total_dibayar}")
        
        # VERIFICATION: nominal_hutang should be price - dp (800k)
        if abs(float(hutang.nominal_hutang) - float(expected_debt)) < 0.01:
            print("SUCCESS: Hutang nominal_hutang correctly reflects remaining balance.")
        else:
            print(f"FAILED: Hutang nominal_hutang is {hutang.nominal_hutang}, expected {expected_debt}")
            
        # 2. Check Neraca report logic for this specific record
        # In NeracaService, debt is calculated as SUM(nominal) - SUM(pembayaran)
        # Since we just created it, SUM(pembayaran) should be 0.
        # So it should show 800k.
        
        # We can simulate the calculation used in NeracaService
        from app.models.keuangan import PembayaranHutang
        from sqlalchemy import func
        
        paid_sum = db.query(func.sum(PembayaranHutang.nominal)).filter(
            PembayaranHutang.hutang_id == hutang.id
        ).scalar() or 0
        
        debt_balance = float(hutang.nominal_hutang) - float(paid_sum)
        print(f"Calculated Debt Balance (Formula: Nominal - Paid): {debt_balance}")
        
        if abs(debt_balance - float(expected_debt)) < 0.01:
            print("SUCCESS: Balance Sheet calculation will show correct debt amount.")
        else:
            print(f"FAILED: Balance Sheet calculation would show {debt_balance}, expected {expected_debt}")

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Cleanup
        print("Cleaning up test data...")
        if 'mobil' in locals():
            # Delete related KasBank entries first
            db.query(KasBank).filter(KasBank.nomor_referensi == mobil.kode).delete()
            db.delete(mobil)
        if 'hutang' in locals() and hutang:
            db.delete(hutang)
        
        db.commit()
        db.close()
        print("Done.")

if __name__ == "__main__":
    test_car_purchase_debt()
