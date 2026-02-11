from app.services.auth_service import AuthService
from app.services.supplier_service import SupplierService
from app.services.customer_service import CustomerService
from app.services.spare_part_service import SparePartService
from app.services.pembelian_part_service import PembelianPartService
from app.services.transaksi_bengkel_service import TransaksiBengkelService
from app.services.pengeluaran_service import PengeluaranService
from app.services.mobil_service import MobilService
from app.services.penjualan_mobil_service import PenjualanMobilService
from app.services.supir_service import SupirService
from app.services.muatan_service import MuatanService
from app.services.karyawan_service import KaryawanService
from app.services.absensi_service import AbsensiService
from app.services.slip_gaji_service import SlipGajiService
from app.services.kasbon_service import KasbonService
from app.services.piutang_service import PiutangService
from app.services.kas_bank_service import KasBankService

__all__ = [
    # Authentication
    "AuthService",
    # Master data
    "SupplierService",
    "CustomerService",
    # Bengkel (Workshop)
    "SparePartService",
    "PembelianPartService",
    "TransaksiBengkelService",
    "PengeluaranService",
    # Jual Beli Mobil (Car Sales)
    "MobilService",
    "PenjualanMobilService",
    # Jasa Angkut (Transportation)
    "SupirService",
    "MuatanService",
    # HR & Payroll
    "KaryawanService",
    "AbsensiService",
    "SlipGajiService",
    "KasbonService",
    # Keuangan (Finance)
    "PiutangService",
    "KasBankService",
]
