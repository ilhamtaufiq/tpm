import sys
import os
from datetime import date
from decimal import Decimal

# Add project root to path
sys.path.append('c:/laragon/www/tpm/backend')

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database.base import Base
# Import all models to register with Base
import app.models.mobil
import app.models.bengkel
import app.models.keuangan
import app.models.customer
import app.models.user
from app.models.mobil import Mobil, MobilBiayaLainnya, MobilPartService, TransaksiPenjualanMobil
from app.models.keuangan import PiutangUsaha, KasBank
from app.models.bengkel import TransaksiPenjualanBengkel, SparePart
from app.services.mobil_service import MobilService
from app.services.penjualan_mobil_service import PenjualanMobilService
from app.services.transaksi_bengkel_service import TransaksiBengkelService
from app.schemas.mobil import MobilCreate, TransaksiMobilCreate
from app.schemas.bengkel import TransaksiBengkelCreate, DetailServiceCreate
from app.utils.constants import OwnershipType, PaymentStatus, PaymentMethod, PiutangSource, CarStatus, KasBankType, KasBankSource
from app.services.kas_bank_integration import create_kas_entry

# Setup in-memory DB
engine = create_engine("sqlite:///:memory:")
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

def run_simulation():
    db = TestingSessionLocal()
    try:
        print("=== SIMULASI JB MOBIL ===")
        
        mobil_service = MobilService(db)
        bengkel_service = TransaksiBengkelService(db)
        penjualan_service = PenjualanMobilService(db)
        
        # 0. Seed Initial Capital: 100,000,000
        print("\n0. Menambah Modal Awal: 100,000,000...")
        create_kas_entry(
            db=db,
            tanggal=date.today(),
            tipe=KasBankType.MASUK,
            nominal=Decimal("100000000"),
            sumber=KasBankSource.MODAL,
            metode_bayar=PaymentMethod.TUNAI,
            referensi_id=None,
            nomor_referensi="MODAL-START",
            keterangan="Modal Awal Simulasi"
        )

        # 1. Create Car Buy: 5,000,000 as Investor (40% baseline)
        print("\n1. Membeli Mobil...")
        mobil_data = MobilCreate(
            merek="Toyota",
            model="Avanza",
            tahun=2020,
            warna="Hitam",
            nomor_plat="B 1234 ABC",
            harga_beli=Decimal("5000000"),
            tipe_kepemilikan=OwnershipType.INVESTOR,
            nama_investor="Investor A",
            persentase_investor=Decimal("40"),
            nominal_investor=Decimal("6500000"), # Full deposit planned
            tanggal_masuk=date.today(),
            status_bayar=PaymentStatus.LUNAS
        )
        mobil = mobil_service.create(mobil_data)
        print(f"   Mobil Berhasil dibuat: {mobil.kode}")
        print(f"   Harga Beli: {mobil.harga_beli}")

        # 2. Add Additional Expense (Non-Workshop): 1,000,000 (e.g. BBN/Pajak)
        # This SHOULD increase HPP
        print("\n2. Menambah Biaya Pengeluaran (Non-Bengkel): 1,000,000...")
        mobil_service.add_biaya(
            mobil_id=mobil.id,
            tanggal=date.today(),
            kategori="BBN",
            deskripsi="Balik Nama",
            jumlah=Decimal("1000000")
        )
        db.refresh(mobil)
        print(f"   HPP Saat Ini (Beli + Expense): {mobil.hpp}")

        # 3. Add Workshop Service: 500,000
        # This SHOULD NOT increase HPP, creates Internal Piutang only (NO bilateral KasBank)
        print("\n3. Menambah Service Bengkel: 500,000...")
        bengkel_data = TransaksiBengkelCreate(
            tanggal=date.today(),
            nama_customer="JB MOBIL",
            nomor_plat=mobil.nomor_plat,
            kategori="jual_beli_mobil",
            mobil_id=mobil.id,
            detail_services=[
                DetailServiceCreate(nama_jasa="Tune Up", harga=Decimal("500000"), qty=1)
            ],
            metode_bayar=PaymentMethod.INTERNAL
        )
        bengkel_trans = bengkel_service.create(bengkel_data)
        db.refresh(mobil)
        
        print(f"   Transaksi Bengkel: {bengkel_trans.nomor_transaksi}")
        print(f"   HPP Tetap (Harus 6jt): {mobil.hpp}")
        print(f"   Total Part & Service: {mobil.total_part_service}")
        print(f"   Total Investasi (HPP + Servis): {mobil.total_modal}")

        # Check internal piutang
        piutang = db.query(PiutangUsaha).filter(
            PiutangUsaha.nomor_referensi == bengkel_trans.nomor_transaksi
        ).first()
        print(f"   Piutang Bengkel Terdeteksi: {piutang.nomor_piutang} - {piutang.nama_debitur} - Status: {piutang.status}")

        # 4. Sell Car: 8,000,000
        print("\n4. Menjual Mobil Senilai 8,000,000...")
        sales_data = TransaksiMobilCreate(
            tanggal=date.today(),
            mobil_id=mobil.id,
            nama_pembeli="Pembeli B",
            harga_jual=Decimal("8000000"),
            dp=Decimal("8000000"), # Lunas
            metode_bayar=PaymentMethod.TRANSFER
        )
        penjualan = penjualan_service.create(sales_data)
        db.refresh(mobil)
        db.refresh(piutang)

        print(f"\n=== HASIL AKHIR ===")
        print(f"Harga Jual: {penjualan.harga_jual}")
        print(f"HPP (Yang diakui di Jurnal): {penjualan.total_modal}")
        print(f"Laba Kotor (Harga Jual - HPP - Servis): {penjualan.laba_kotor}")
        
        # Pro-rata Calculation check:
        # Total Modal = 6.5jt. Investor deposit = 6.5jt. Ratio = 1.0. Bagian = 40% * 1.0 = 40%.
        # Laba = 1.5jt. 40% dari 1.5jt = 600,000.
        print(f"Laba Investor: {penjualan.laba_investor}")
        print(f"Laba TPM: {penjualan.laba_tpm}")
        print(f"Status Piutang Bengkel (Harus Lunas): {piutang.status}")
        
        # Validasi
        assert penjualan.total_modal == Decimal("6000000") # 5jt + 1jt
        assert penjualan.laba_kotor == Decimal("1500000") # 8jt - 6jt - 500rb
        assert piutang.status == "LUNAS"
        assert penjualan.laba_investor == Decimal("600000.00")
        
        print("\n✅ SIMULASI BERHASIL! Semua aturan bisnis sesuai.")

    except Exception as e:
        print(f"\n❌ SIMULASI GAGAL: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    run_simulation()
