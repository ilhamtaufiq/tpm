from enum import Enum


class UserRole(str, Enum):
    """User roles in the system."""

    ADMIN = "admin"
    MANAGER = "manager"
    STAFF = "staff"
    VIEWER = "viewer"


class TransactionType(str, Enum):
    """Types of transactions."""

    PEMBELIAN = "pembelian"
    PENJUALAN = "penjualan"
    RETUR = "retur"
    ADJUSTMENT = "adjustment"


class WorkshopStatus(str, Enum):
    """Workshop transaction/queue status."""

    ANTRE = "antre"
    PROSES = "proses"
    SELESAI = "selesai"
    BATAL = "batal"


class PaymentStatus(str, Enum):
    """Payment status for transactions."""

    LUNAS = "lunas"
    BELUM_LUNAS = "belum_lunas"
    CICILAN = "cicilan"


class PaymentMethod(str, Enum):
    """Payment methods."""

    TUNAI = "tunai"
    TRANSFER = "transfer"
    KREDIT = "kredit"
    DEBIT = "debit"


class AttendanceStatus(str, Enum):
    """Employee attendance status."""

    HADIR = "hadir"
    IZIN = "izin"
    SAKIT = "sakit"
    ALPHA = "alpha"
    CUTI = "cuti"


class EmployeeStatus(str, Enum):
    """Employee employment status."""

    AKTIF = "aktif"
    TIDAK_AKTIF = "tidak_aktif"
    RESIGN = "resign"


class CarStatus(str, Enum):
    """Car inventory status."""

    TERSEDIA = "tersedia"
    TERJUAL = "terjual"
    DALAM_PERBAIKAN = "dalam_perbaikan"
    BOOKING = "booking"


class OwnershipType(str, Enum):
    """Car ownership type."""

    TPM = "tpm"
    INVESTOR = "investor"


class PiutangStatus(str, Enum):
    """Receivable (piutang) status."""

    BELUM_LUNAS = "belum_lunas"
    LUNAS = "lunas"
    SEBAGIAN = "sebagian"


class KasBankType(str, Enum):
    """Cash/Bank transaction type."""

    MASUK = "masuk"
    KELUAR = "keluar"


class ExpenseCategory(str, Enum):
    """Expense categories for workshop."""

    BIAYA_OPERASIONAL = "biaya_operasional"
    BIAYA_LAINNYA = "biaya_lainnya"
    PRIVE = "prive"


class PiutangSource(str, Enum):
    """Source of piutang (receivable)."""

    BENGKEL = "bengkel"
    JUAL_BELI_MOBIL = "jual_beli_mobil"
    JASA_ANGKUT = "jasa_angkut"
    KASBON_KARYAWAN = "kasbon_karyawan"
    LAINNYA = "lainnya"


class KasBankSource(str, Enum):
    """Source of kas/bank transaction."""

    BENGKEL = "bengkel"
    JUAL_BELI_MOBIL = "jual_beli_mobil"
    JASA_ANGKUT = "jasa_angkut"
    PEMBELIAN_PART = "pembelian_part"
    PEMBELIAN_MOBIL = "pembelian_mobil"
    PENGELUARAN = "pengeluaran"
    GAJI = "gaji"
    KASBON = "kasbon"
    PIUTANG = "piutang"
    MODAL = "modal"
    PRIVE = "prive"
    LAINNYA = "lainnya"


class KasBankJenis(str, Enum):
    """Type of kas/bank account."""

    CASH = "cash"
    BANK_BCA = "bank_bca"
    BANK_MANDIRI = "bank_mandiri"
    BANK_BRI = "bank_bri"
    BANK_LAINNYA = "bank_lainnya"


# Transaction number prefixes
TRANSACTION_PREFIXES = {
    "bengkel": "BGL",
    "mobil": "MBL",
    "jasa_angkut": "JAS",
    "pembelian": "PBL",
    "pengeluaran": "PGL",
    "piutang": "PTG",
    "kas_bank": "KAS",
    "slip_gaji": "GJI",
    "karyawan": "KRY",
    "kasbon": "KSB",
    "absensi": "ABS",
}

# Default profit split for Jasa Angkut (50% to TPM)
JASA_ANGKUT_PROFIT_SPLIT = 0.5

# Default values
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
