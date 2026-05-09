import sys
import os
from datetime import date, datetime
from decimal import Decimal

# Add current directory to path
sys.path.append(os.getcwd())

from app.database.connection import SessionLocal
from app.models.mobil import Mobil, TransaksiPenjualanMobil
from app.models.keuangan import HutangUsaha, PiutangUsaha, KasBank, KasBankJenis, KasBankType, KasBankSource
from app.models.bengkel import TransaksiPenjualanBengkel
from app.services.mobil_service import MobilService
from app.services.penjualan_mobil_service import PenjualanMobilService
from app.services.transaksi_bengkel_service import TransaksiBengkelService
from app.services.kas_bank_service import KasBankService
from app.services.reports.neraca_service import NeracaService
from app.services.reports.modal_service import ModalService
from app.schemas.mobil import MobilCreate, TransaksiMobilCreate, MobilBiayaCreate
from app.schemas.bengkel import TransaksiBengkelCreate, DetailPartCreate, DetailServiceCreate
from app.utils.constants import PaymentMethod, CarStatus, OwnershipType, PaymentStatus, HutangSource, PiutangSource

def run_test():
    db = SessionLocal()
    try:
        print("--- STARTING CAR BUSINESS UNIT SCENARIO TEST ---")
        
        # 0. Check for a valid spare part ID
        from app.models.bengkel import SparePart
        spare_part = db.query(SparePart).filter(SparePart.deleted_at.is_(None)).first()
        if not spare_part:
            # Create a dummy spare part if none exists
            from app.models.bengkel import SparePart
            spare_part = SparePart(
                kode="SP-TEST",
                nama="Test Spare Part",
                stok=Decimal("10"),
                harga_beli=Decimal("1000000"),
                harga_jual=Decimal("2000000")
            )
            db.add(spare_part)
            db.commit()
            db.refresh(spare_part)
        else:
            # Ensure it has enough stock
            spare_part.stok = Decimal("10")
            db.commit()
            db.refresh(spare_part)
        
        sp_id = spare_part.id

        kas_bank_service = KasBankService(db)
        from app.schemas.keuangan import KasBankCreate

        # 1. SETUP: Initial Capital (Modal) to have cash
        print("\nStep 1: Setting up initial capital...")
        kas_bank_service.create(
            data=KasBankCreate(
                tanggal=date.today(),
                tipe=KasBankType.MASUK,
                nominal=Decimal("200000000"), # 200jt
                sumber=KasBankSource.MODAL,
                jenis=KasBankJenis.KAS_UTAMA,
                keterangan="Initial Capital for Test"
            ),
            user_id=1
        )

        mobil_service = MobilService(db)
        penjualan_service = PenjualanMobilService(db)
        bengkel_service = TransaksiBengkelService(db)
        neraca_service = NeracaService(db)
        modal_service = ModalService(db)

        # 2. PURCHASE: Buy a car with DP
        print("\nStep 2: Purchasing a car with DP...")
        # Price 100jt, DP 20jt, Debt 80jt
        car_data = MobilCreate(
            merek="TOYOTA",
            model="AVANZA TEST",
            tahun=2020,
            nomor_plat="TEST-123",
            warna="HITAM",
            harga_beli=Decimal("100000000"),
            tanggal_masuk=date.today(),
            keterangan="Test Car",
            tipe_kepemilikan=OwnershipType.TPM,
            status=CarStatus.TERSEDIA,
            status_bayar=PaymentStatus.BELUM_LUNAS,
            dp=Decimal("20000000"),
            kas_jenis=KasBankJenis.KAS_UTAMA,
            metode_bayar=PaymentMethod.TUNAI
        )
        
        mobil = mobil_service.create(
            data=car_data,
            user_id=1
        )
        print(f"Car Created: {mobil.model} (ID: {mobil.id})")
        
        # 3. EXPENSE: Add Admin Cost (BBN/Pajak)
        print("\nStep 3: Adding admin costs (BBN)...")
        biaya_bbm = mobil_service.add_biaya(
            mobil_id=mobil.id,
            tanggal=date.today(),
            kategori="BBN/Pajak",
            deskripsi="Balik Nama",
            jumlah=Decimal("5000000"), # 5jt
            metode_bayar=PaymentMethod.TUNAI,
            kas_jenis=KasBankJenis.KAS_UTAMA,
            user_id=1
        )

        # 4. REPAIR: Internal Workshop Repair
        print("\nStep 4: Internal Workshop Repair...")
        # Repair cost 2jt
        bengkel_trx = bengkel_service.create(
            data=TransaksiBengkelCreate(
                tanggal=date.today(),
                nama_customer="UNIT MOBIL - TEST",
                kategori="jual_beli_mobil",
                mobil_id=mobil.id,
                detail_parts=[DetailPartCreate(spare_part_id=sp_id, qty=1, harga_jual=Decimal("2000000"))],
                detail_services=[],
                metode_bayar=PaymentMethod.KREDIT,
                diskon=Decimal("0"),
                jumlah_bayar=Decimal("0")
            ),
            user_id=1
        )
        print(f"Internal Repair Created: {bengkel_trx.nomor_transaksi}")

        # 5. SALE: Sell car with DP (Booking)
        print("\nStep 5: Selling car with Booking (DP)...")
        # Sell price 120jt, DP 30jt, Piutang 90jt
        sale_trx = penjualan_service.create(
            data=TransaksiMobilCreate(
                tanggal=date.today(),
                mobil_id=mobil.id,
                harga_jual=Decimal("120000000"),
                dp=Decimal("30000000"),
                metode_bayar=PaymentMethod.TUNAI,
                kas_jenis=KasBankJenis.KAS_UTAMA,
                catatan="Sale Test",
                nama_pembeli="Buyer Test",
                telepon_pembeli="08123",
                alamat_pembeli="Jl. Test"
            ),
            user_id=1
        )
        print(f"Sale Recorded: {sale_trx.nomor_transaksi}")
        db.refresh(mobil)
        print(f"Car Status: {mobil.status}")

        # 6. SETTLEMENT: Pelunasan Sale
        print("\nStep 6: Pelunasan Sale (Full payment)...")
        # Pay 90jt (Remaining sisa_bayar from 110jt - 20jt DP)
        penjualan_service.update_payment(
            transaksi_id=sale_trx.id,
            jumlah_bayar=Decimal("90000000"),
            payments=[(PaymentMethod.TUNAI, Decimal("90000000"), KasBankJenis.KAS_UTAMA)],
            user_id=1
        )
        print("Sale Fully Paid.")
        db.refresh(mobil)
        print(f"Final Car Status: {mobil.status}")

        # 7. CHECKING REPORTS
        print("\nStep 7: Checking Reports...")
        
        neraca_service = NeracaService(db)
        modal_service = ModalService(db)
        
        # We must call get_report twice to trigger the sync and then verify
        neraca = neraca_service.get_report(date.today())
        modal = modal_service.get_report(date.today(), date.today())
        
        # Check Dealer debt for THIS car
        dealer_debt = db.query(HutangUsaha).filter(
            HutangUsaha.sumber == HutangSource.PEMBELIAN_MOBIL,
            HutangUsaha.referensi_id == mobil.id
        ).first()
        
        print("\n--- SPECIFIC UNIT CHECK ---")
        if dealer_debt:
            print(f"Car: {mobil.nomor_plat}")
            print(f"Price: {mobil.harga_beli:,.2f}")
            print(f"Debt Balance: {dealer_debt.sisa_hutang:,.2f} (Expected: 80,000,000.00)")
        else:
            print(f"No Dealer Debt found for {mobil.nomor_plat}!")

        # Check Internal Repair status
        piutang = db.query(PiutangUsaha).filter(PiutangUsaha.nomor_referensi == bengkel_trx.nomor_transaksi).first()
        hutang = db.query(HutangUsaha).filter(HutangUsaha.nomor_referensi == bengkel_trx.nomor_transaksi).first()
        
        p_val = piutang.sisa_piutang if piutang else Decimal("0")
        h_val = hutang.sisa_hutang if hutang else Decimal("0")
        
        print(f"\nInternal Repair ({bengkel_trx.nomor_transaksi}):")
        print(f"Piutang Sisa: {p_val:,.2f}")
        print(f"Hutang Sisa: {h_val:,.2f}")
        print(f"Gap: {float(p_val - h_val):,.2f} (Expected: 0.00)")

        # Verification logic
        if not neraca['is_balanced']:
            print("\n!!! DISCREPANCY DETECTED IN NERACA !!!")
            for m in neraca['cross_validation'].get('mismatches', []):
                print(f"  Mismatch: {m['ref']} - Gap: {m['gap']}")
        else:
            print("\nNeraca is PERFECTLY BALANCED.")

    except Exception as e:
        print(f"Error during test: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
        print("\nTest completed. Data remains in database for manual verification.")

if __name__ == "__main__":
    run_test()
