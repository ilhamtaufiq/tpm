from enum import Enum


class UserRole(str, Enum):
    """User roles in the system."""

    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    KASIR = "KASIR"
    MEKANIK = "MEKANIK"
    STAFF = "STAFF"
    VIEWER = "VIEWER"
    BENGKEL = "BENGKEL"
    JASA_ANGKUT = "JASA_ANGKUT"
    MOBIL = "MOBIL"

    @classmethod
    def _missing_(cls, value: object) -> "UserRole | None":
        if isinstance(value, str):
            upper = value.upper()
            for member in cls:
                if member.value == upper:
                    return member
        return None


class TransactionType(str, Enum):
    """Types of transactions."""

    PEMBELIAN = "PEMBELIAN"
    PENJUALAN = "PENJUALAN"
    RETUR = "RETUR"
    ADJUSTMENT = "ADJUSTMENT"

    @classmethod
    def _missing_(cls, value: object) -> "TransactionType | None":
        if isinstance(value, str):
            upper = value.upper()
            for member in cls:
                if member.value == upper:
                    return member
        return None


class WorkshopStatus(str, Enum):
    """Workshop transaction/queue status."""

    ANTRE = "ANTRE"
    PROSES = "PROSES"
    SELESAI = "SELESAI"
    BATAL = "BATAL"

    @classmethod
    def _missing_(cls, value: object) -> "WorkshopStatus | None":
        if isinstance(value, str):
            upper = value.upper()
            for member in cls:
                if member.value == upper:
                    return member
        return None


class MuatanStatus(str, Enum):
    """Transport load (ritase) status."""

    PROSES = "PROSES"
    SELESAI = "SELESAI"

    @classmethod
    def _missing_(cls, value: object) -> "MuatanStatus | None":
        if isinstance(value, str):
            upper = value.upper()
            for member in cls:
                if member.value == upper:
                    return member
        return None


class PaymentStatus(str, Enum):
    """Payment status for transactions."""

    LUNAS = "LUNAS"
    BELUM_LUNAS = "BELUM_LUNAS"
    CICILAN = "CICILAN"
    BATAL = "BATAL"

    @classmethod
    def _missing_(cls, value: object) -> "PaymentStatus | None":
        if isinstance(value, str):
            upper = value.upper().replace(' ', '_')
            for member in cls:
                if member.value == upper:
                    return member
        return None


class PaymentMethod(str, Enum):
    """Payment methods."""

    TUNAI = "TUNAI"
    TRANSFER = "TRANSFER"
    KREDIT = "KREDIT"
    DEBIT = "DEBIT"
    SPLIT = "SPLIT"
    INTERNAL = "INTERNAL"
    POTONG_GAJI = "POTONG_GAJI"
    OTHER = "OTHER"

    @classmethod
    def _missing_(cls, value: object) -> "PaymentMethod | None":
        """Allow case-insensitive lookup so frontend can send lowercase values."""
        if isinstance(value, str):
            upper = value.upper()
            for member in cls:
                if member.value == upper:
                    return member
        return None


class AttendanceStatus(str, Enum):
    """Employee attendance status."""

    HADIR = "HADIR"
    IZIN = "IZIN"
    SAKIT = "SAKIT"
    ALPHA = "ALPHA"
    CUTI = "CUTI"
    SETENGAH_HARI = "SETENGAH_HARI"

    @classmethod
    def _missing_(cls, value: object) -> "AttendanceStatus | None":
        if isinstance(value, str):
            upper = value.upper()
            for member in cls:
                if member.value == upper:
                    return member
        return None


class EmployeeStatus(str, Enum):
    """Employee employment status."""

    AKTIF = "AKTIF"
    TIDAK_AKTIF = "TIDAK_AKTIF"
    RESIGN = "RESIGN"

    @classmethod
    def _missing_(cls, value: object) -> "EmployeeStatus | None":
        if isinstance(value, str):
            upper = value.upper().replace(' ', '_')
            for member in cls:
                if member.value == upper:
                    return member
        return None


class CarStatus(str, Enum):
    """Car inventory status."""

    TERSEDIA = "TERSEDIA"
    TERJUAL = "TERJUAL"
    DALAM_PERBAIKAN = "DALAM_PERBAIKAN"
    BOOKING = "BOOKING"

    @classmethod
    def _missing_(cls, value: object) -> "CarStatus | None":
        if isinstance(value, str):
            upper = value.upper().replace(' ', '_')
            for member in cls:
                if member.value == upper:
                    return member
        return None


class OwnershipType(str, Enum):
    """Car ownership type."""

    TPM = "TPM"
    INVESTOR = "INVESTOR"

    @classmethod
    def _missing_(cls, value: object) -> "OwnershipType | None":
        if isinstance(value, str):
            upper = value.upper()
            for member in cls:
                if member.value == upper:
                    return member
        return None


class InvestorDisbursementStatus(str, Enum):
    """Status pencairan dana investor setelah mobil terjual."""

    BELUM_DICAIRKAN = "BELUM_DICAIRKAN"
    SEBAGIAN = "SEBAGIAN"
    DICAIRKAN = "DICAIRKAN"

    @classmethod
    def _missing_(cls, value: object) -> "InvestorDisbursementStatus | None":
        if isinstance(value, str):
            upper = value.upper().replace(' ', '_')
            for member in cls:
                if member.value == upper:
                    return member
        return None


class PiutangStatus(str, Enum):
    """Receivable (piutang) status."""

    BELUM_LUNAS = "BELUM_LUNAS"
    LUNAS = "LUNAS"
    SEBAGIAN = "SEBAGIAN"
    BATAL = "BATAL"


    @classmethod
    def _missing_(cls, value: object) -> "PiutangStatus | None":
        if isinstance(value, str):
            upper = value.upper().replace(' ', '_')
            for member in cls:
                if member.value == upper:
                    return member
        return None


class HutangStatus(str, Enum):
    """Payable (hutang) status."""

    BELUM_LUNAS = "BELUM_LUNAS"
    LUNAS = "LUNAS"
    SEBAGIAN = "SEBAGIAN"
    BATAL = "BATAL"


    @classmethod
    def _missing_(cls, value: object) -> "HutangStatus | None":
        if isinstance(value, str):
            upper = value.upper().replace(' ', '_')
            for member in cls:
                if member.value == upper:
                    return member
        return None


class KasBankType(str, Enum):
    """Cash/Bank transaction type."""

    MASUK = "MASUK"
    KELUAR = "KELUAR"

    @classmethod
    def _missing_(cls, value: object) -> "KasBankType | None":
        if isinstance(value, str):
            upper = value.upper()
            for member in cls:
                if member.value == upper:
                    return member
        return None


class AssetCategory(str, Enum):
    """Categories of fixed assets."""

    KENDARAAN = "KENDARAAN"
    PERALATAN = "PERALATAN"
    BANGUNAN = "BANGUNAN"
    TANAH = "TANAH"
    ELECTRONIC = "ELECTRONIC"
    LAINNYA = "LAINNYA"

    @classmethod
    def _missing_(cls, value: object) -> "AssetCategory | None":
        if isinstance(value, str):
            upper = value.upper().replace(' ', '_')
            for member in cls:
                if member.value == upper:
                    return member
        return None


class AssetStatus(str, Enum):
    """Status of physical assets."""

    AKTIF = "AKTIF"
    RUSAK = "RUSAK"
    DIJUAL = "DIJUAL"
    HILANG = "HILANG"

    @classmethod
    def _missing_(cls, value: object) -> "AssetStatus | None":
        if isinstance(value, str):
            upper = value.upper()
            for member in cls:
                if member.value == upper:
                    return member
        return None


class ExpenseCategory(str, Enum):
    """Expense categories for workshop."""

    BIAYA_OPERASIONAL = "BIAYA_OPERASIONAL"
    BIAYA_LAINNYA = "BIAYA_LAINNYA"
    PRIVE = "PRIVE"
    # Old values from initial schema if needed
    OPERASIONAL = "BIAYA_OPERASIONAL"
    PEMELIHARAAN = "BIAYA_LAINNYA"
    GAJI = "GAJI"
    UTILITAS = "OPERASIONAL"

    @classmethod
    def _missing_(cls, value: object) -> "ExpenseCategory | None":
        if isinstance(value, str):
            upper = value.upper().replace(' ', '_')
            for member in cls:
                if member.value == upper:
                    return member
            # Map old ones if they exist in DB
            if upper == "OPERASIONAL": return cls.BIAYA_OPERASIONAL
            if upper == "PEMELIHARAAN": return cls.BIAYA_LAINNYA
        return None


class PiutangSource(str, Enum):
    """Source of piutang (receivable)."""

    BENGKEL = "BENGKEL"
    JUAL_BELI_MOBIL = "JUAL_BELI_MOBIL"
    JASA_ANGKUT = "JASA_ANGKUT"
    KASBON_KARYAWAN = "KASBON_KARYAWAN"
    LAINNYA = "LAINNYA"

    @classmethod
    def _missing_(cls, value: object) -> "PiutangSource | None":
        if isinstance(value, str):
            upper = value.upper().replace(' ', '_')
            for member in cls:
                if member.value == upper:
                    return member
        return None


class HutangSource(str, Enum):
    """Source of hutang (payable)."""

    PEMBELIAN_PART = "PEMBELIAN_PART"
    PEMBELIAN_MOBIL = "PEMBELIAN_MOBIL"
    JUAL_BELI_MOBIL = "JUAL_BELI_MOBIL"
    LAINNYA = "LAINNYA"

    @classmethod
    def _missing_(cls, value: object) -> "HutangSource | None":
        if isinstance(value, str):
            upper = value.upper().replace(' ', '_')
            for member in cls:
                if member.value == upper:
                    return member
        return None


class KasBankSource(str, Enum):
    """Source of kas/bank transaction."""

    BENGKEL = "BENGKEL"
    JUAL_BELI_MOBIL = "JUAL_BELI_MOBIL"
    JASA_ANGKUT = "JASA_ANGKUT"
    PEMBELIAN_PART = "PEMBELIAN_PART"
    PEMBELIAN_MOBIL = "PEMBELIAN_MOBIL"
    PENGELUARAN = "PENGELUARAN"
    GAJI = "GAJI"
    KASBON = "KASBON"
    PIUTANG = "PIUTANG"
    HUTANG = "HUTANG"
    MODAL = "MODAL"
    PRIVE = "PRIVE"
    ASET = "ASET"
    LAINNYA = "LAINNYA"

    @classmethod
    def _missing_(cls, value: object) -> "KasBankSource | None":
        if isinstance(value, str):
            upper = value.upper().replace(' ', '_')
            for member in cls:
                if member.value == upper:
                    return member
        return None


class KasBankJenis(str, Enum):
    """Type of kas/bank account."""

    CASH = "CASH"
    BANK_BCA = "BANK_BCA"
    BANK_MANDIRI = "BANK_MANDIRI"
    BANK_BRI = "BANK_BRI"
    BANK_LAINNYA = "BANK_LAINNYA"
    
    # --- New Unit-Specific Cash Accounts ---
    KAS_UNIT_BENGKEL = "KAS_UNIT_BENGKEL"
    KAS_UNIT_JASA_ANGKUT = "KAS_UNIT_JASA_ANGKUT"
    KAS_UNIT_MOBIL = "KAS_UNIT_MOBIL"
    
    # --- Main/Central Accounts ---
    KAS_UTAMA = "KAS_UTAMA"
    BANK_UTAMA = "BANK_UTAMA"

    @classmethod
    def _missing_(cls, value: object) -> "KasBankJenis | None":
        if isinstance(value, str):
            upper = value.upper().replace(' ', '_')
            for member in cls:
                if member.value == upper:
                    return member
        return None


# Transaction number prefixes
TRANSACTION_PREFIXES = {
    "bengkel": "BGL",
    "mobil": "MBL",
    "jasa_angkut": "JAS",
    "pembelian": "PBL",
    "pengeluaran": "PGL",
    "piutang": "PTG",
    "hutang": "HTG",
    "kas_bank": "KAS",
    "slip_gaji": "GJI",
    "karyawan": "KRY",
    "kasbon": "KSB",
    "absensi": "ABS",
    "aset": "AST",
}

# Default profit split for Jasa Angkut (50% to TPM)
JASA_ANGKUT_PROFIT_SPLIT = 0.5

# Default values
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
