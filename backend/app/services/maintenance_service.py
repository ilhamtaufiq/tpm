from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.bengkel import (
    TransaksiPenjualanBengkel,
    DetailTransaksiSpareParts,
    DetailTransaksiServices,
    PembelianSparePart,
    DetailPembelianSparePart,
    PengeluaranBengkel,
    SparePart
)
from app.models.keuangan import PiutangUsaha, PembayaranPiutang, KasBank
from app.models.jasa_angkut import MuatanJasaAngkut, JasaAngkutBiayaLainnya, JasaAngkutPartService
from app.models.karyawan import Absensi, SlipGaji, KasbonKaryawan
from app.models.mobil import (
    TransaksiPenjualanMobil,
    MobilBiayaLainnya,
    MobilPartService,
    Mobil
)
from app.utils.constants import CarStatus


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
        4. Delete all car sales transactions.
        5. Delete all receivables (piutang) and payments.
        6. Delete all workshop expenses.
        7. Delete all employee transactions (Absensi, Kasbon, Slip Gaji).
        8. Delete all cash/bank journal entries (KasBank) - LAST.
        9. Reset spare part stocks to 0.
        10. Reset car statuses to AVAILABLE.
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
            
            # 4. Receivables (Piutang)
            print("RESET: Deleting receivables...")
            self.db.query(PiutangUsaha).delete()

            # 5. Ledger (KasBank) - Must be last as it is often referenced or parent
            print("RESET: Deleting ledger (KasBank)...")
            self.db.query(KasBank).delete()

            # 6. Reset Master Data States
            print("RESET: Resetting master data states...")
            # Reset Spare Part Stock
            self.db.query(SparePart).update({SparePart.stok: 0})

            # Reset Mobil Status
            self.db.query(Mobil).update({
                Mobil.status: CarStatus.TERSEDIA,
                Mobil.tanggal_terjual: None
            })

            self.db.commit()
            print("RESET: Success.")
            return {"status": "success", "message": "All transaction data has been reset."}
        except Exception as e:
            self.db.rollback()
            print(f"RESET: Error occurred: {str(e)}")
            raise e
