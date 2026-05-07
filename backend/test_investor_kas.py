import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from datetime import date
from decimal import Decimal
from app.database.connection import SessionLocal
from app.services.mobil_service import MobilService
from app.schemas.mobil import MobilCreate
from app.utils.constants import OwnershipType, PaymentStatus, PaymentMethod, KasBankJenis, KasBankType
from app.models.keuangan import KasBank

def test():
    db = SessionLocal()
    service = MobilService(db)
    
    # Test Data
    import time
    plat = f"T-{int(time.time()) % 100000}"
    data = MobilCreate(
        merek="Toyota",
        model="Test Investor",
        tahun=2024,
        warna="Hitam",
        nomor_plat=plat,
        harga_beli=Decimal("100000000"),
        tipe_kepemilikan=OwnershipType.INVESTOR,
        nama_investor="Pak Investor",
        nominal_investor=Decimal("100000000"),
        persentase_investor=Decimal("50"),
        tanggal_masuk=date.today(),
        status_bayar=PaymentStatus.LUNAS,
        metode_bayar=PaymentMethod.TRANSFER,
        kas_jenis=KasBankJenis.BANK_UTAMA,
        investor_kas_jenis=KasBankJenis.KAS_UTAMA # This is the NEW field
    )
    
    print(f"Creating car with plat: {plat}")
    print(f"Purchase account: BANK_UTAMA")
    print(f"Investor account: KAS_UTAMA (Target)")
    
    try:
        mobil = service.create(data)
        
        # Check KasBank entries
        # Note: We need to check by nomor_referensi or referensi_id
        entries = db.query(KasBank).filter(
            KasBank.nomor_referensi == mobil.kode
        ).all()
        
        print(f"\nFound {len(entries)} KasBank entries:")
        for entry in entries:
            account_name = entry.jenis.value if hasattr(entry.jenis, 'value') else str(entry.jenis)
            print(f"  [{entry.tipe}] {entry.nominal:,.0f} | Account: {account_name} | Note: {entry.keterangan[:50]}...")
            
            # Verification
            if entry.tipe == KasBankType.MASUK:
                if account_name == "KAS_UTAMA":
                    print("  [OK] SUCCESS: Investor fund went to KAS_UTAMA")
                else:
                    print(f"  [ERROR] FAILED: Investor fund went to {account_name} instead of KAS_UTAMA")
            
            if entry.tipe == KasBankType.KELUAR:
                if account_name == "BANK_UTAMA":
                    print("  [OK] SUCCESS: Purchase payment came from BANK_UTAMA")
                else:
                    print(f"  [ERROR] FAILED: Purchase payment came from {account_name} instead of BANK_UTAMA")
        
        # Clean up
        print("\nRolling back transaction...")
        db.rollback()
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    test()
