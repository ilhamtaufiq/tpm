from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import date
from app.models.bengkel import (
    TransaksiPenjualanBengkel,
    DetailTransaksiSpareParts,
    DetailTransaksiServices,
    PembelianSparePart,
    DetailPembelianSparePart,
    PengeluaranBengkel,
    SparePart
)
from app.models.keuangan import PiutangUsaha, PembayaranPiutang, KasBank, HutangUsaha, PembayaranHutang
from app.models.jasa_angkut import MuatanJasaAngkut, JasaAngkutBiayaLainnya, JasaAngkutPartService
from app.models.karyawan import Absensi, SlipGaji, KasbonKaryawan
from app.models.mobil import (
    TransaksiPenjualanMobil,
    MobilBiayaLainnya,
    MobilPartService,
    MobilMedia,
    Mobil
)
from app.utils.constants import CarStatus, KasBankType, KasBankSource, KasBankJenis


class MaintenanceService:
    """Service for system maintenance tasks."""

    def __init__(self, db: Session):
        self.db = db

    def reset_transactions(self) -> dict:
        """Reset all transaction data while keeping master data.
        
        This will:
        1. Delete all workshop transactions and details.
        2. Delete all spare part purchases.
        3. Delete all freight (jasa angkut) transactions.
        4. Delete all car sales transactions and car inventory (Mobil).
        5. Delete all receivables (piutang), payables (hutang), and payments.
        6. Delete all workshop expenses.
        7. Delete all employee transactions (Absensi, Kasbon, Slip Gaji).
        8. Delete all cash/bank journal entries (KasBank) - LAST.
        9. Reset spare part stocks to 0.
        """
        try:
            print("RESET: Starting transaction reset process...")

            # 1. Detail Tables (Child records first)
            print("RESET: Deleting details (SpareParts, Services, BiayaLainnya)...")
            self.db.query(DetailTransaksiSpareParts).delete()
            self.db.query(DetailTransaksiServices).delete()
            self.db.query(DetailPembelianSparePart).delete()
            self.db.query(JasaAngkutBiayaLainnya).delete()
            self.db.query(JasaAngkutPartService).delete()
            self.db.query(MobilBiayaLainnya).delete()
            self.db.query(MobilPartService).delete()
            self.db.query(MobilMedia).delete()
            self.db.query(Absensi).delete()
            
            # 2. Main Transaction Tables
            print("RESET: Deleting main transactions (Bengkel, Mobil, Jasa Angkut)...")
            self.db.query(TransaksiPenjualanBengkel).delete()
            self.db.query(PembelianSparePart).delete()
            self.db.query(TransaksiPenjualanMobil).delete()
            self.db.query(MuatanJasaAngkut).delete()
            self.db.query(SlipGaji).delete()
            self.db.query(KasbonKaryawan).delete()

            # 3. Expenses & Payments
            print("RESET: Deleting expenses and payments...")
            self.db.query(PengeluaranBengkel).delete()
            self.db.query(PembayaranPiutang).delete()
            self.db.query(PembayaranHutang).delete()

            # 4. Receivables (Piutang) & Payables (Hutang)
            print("RESET: Deleting receivables and payables...")
            self.db.query(PiutangUsaha).delete()
            self.db.query(HutangUsaha).delete()

            # 5. Ledger (KasBank) - Must be last as it is often referenced or parent
            print("RESET: Deleting ledger (KasBank)...")
            self.db.query(KasBank).delete()

            # 6. Reset Master Data States
            print("RESET: Resetting master data states...")
            # Reset Spare Part Stock
            self.db.query(SparePart).update({SparePart.stok: 0})

            # Menghapus Stock Mobil (Inventory) - Sesuai permintaan user
            print("RESET: Deleting car inventory stock (Mobil)...")
            self.db.query(Mobil).delete()

            # 7. Initial Capital Injection (Setoran Modal)
            # 5M to Kas Utama, 5M to Bank Utama
            print("RESET: Injecting initial capital (5M Tunai, 5M Bank)...")
            
            today_str = date.today().strftime("%y%m%d")
            
            initial_tunai = KasBank(
                nomor_transaksi=f"KAS{today_str}0001",
                tanggal=date.today(),
                jenis=KasBankJenis.KAS_UTAMA,
                tipe=KasBankType.MASUK,
                sumber=KasBankSource.MODAL,
                nominal=5000000,
                saldo_sebelum=0,
                saldo_sesudah=5000000,
                keterangan="Setoran Modal Awal (Kas Utama) - System Reset"
            )
            initial_bank = KasBank(
                nomor_transaksi=f"KAS{today_str}0002",
                tanggal=date.today(),
                jenis=KasBankJenis.BANK_UTAMA,
                tipe=KasBankType.MASUK,
                sumber=KasBankSource.MODAL,
                nominal=5000000,
                saldo_sebelum=0,
                saldo_sesudah=5000000,
                keterangan="Setoran Modal Awal (Bank Utama) - System Reset"
            )
            self.db.add(initial_tunai)
            self.db.add(initial_bank)

            self.db.commit()
            print("RESET: Success.")
            return {"status": "success", "message": "All transaction data has been reset."}
        except Exception as e:
            self.db.rollback()
            print(f"RESET: Error occurred: {str(e)}")
            raise e
