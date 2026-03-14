from app.schemas.user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserLogin,
    Token,
    TokenPayload,
)
from app.schemas.master import (
    SupplierCreate,
    SupplierUpdate,
    SupplierResponse,
    CustomerCreate,
    CustomerUpdate,
    CustomerResponse,
)
from app.schemas.bengkel import (
    SparePartCreate,
    SparePartUpdate,
    SparePartResponse,
    PembelianSparePartCreate,
    PembelianSparePartResponse,
    TransaksiBengkelCreate,
    TransaksiBengkelResponse,
    PengeluaranBengkelCreate,
    PengeluaranBengkelResponse,
)
from app.schemas.mobil import (
    MobilCreate,
    MobilUpdate,
    MobilResponse,
    MobilList,
    TransaksiMobilCreate,
    TransaksiMobilResponse,
    InvestorDisbursementDetailResponse,
)
from app.schemas.jasa_angkut import (
    SupirCreate,
    SupirUpdate,
    SupirResponse,
    MuatanCreate,
    MuatanResponse,
)
from app.schemas.karyawan import (
    KaryawanCreate,
    KaryawanUpdate,
    KaryawanResponse,
    AbsensiCreate,
    AbsensiResponse,
    SlipGajiCreate,
    SlipGajiResponse,
)
from app.schemas.keuangan import (
    PiutangCreate,
    PiutangResponse,
    PembayaranPiutangCreate,
    KasBankCreate,
    KasBankResponse,
)

__all__ = [
    # User
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "UserLogin",
    "Token",
    "TokenPayload",
    # Master
    "SupplierCreate",
    "SupplierUpdate",
    "SupplierResponse",
    "CustomerCreate",
    "CustomerUpdate",
    "CustomerResponse",
    # Bengkel
    "SparePartCreate",
    "SparePartUpdate",
    "SparePartResponse",
    "PembelianSparePartCreate",
    "PembelianSparePartResponse",
    "TransaksiBengkelCreate",
    "TransaksiBengkelResponse",
    "PengeluaranBengkelCreate",
    "PengeluaranBengkelResponse",
    # Mobil
    "MobilCreate",
    "MobilUpdate",
    "MobilResponse",
    "MobilList",
    "TransaksiMobilCreate",
    "TransaksiMobilResponse",
    "InvestorDisbursementDetailResponse",
    # Jasa Angkut
    "SupirCreate",
    "SupirUpdate",
    "SupirResponse",
    "MuatanCreate",
    "MuatanResponse",
    # Karyawan
    "KaryawanCreate",
    "KaryawanUpdate",
    "KaryawanResponse",
    "AbsensiCreate",
    "AbsensiResponse",
    "SlipGajiCreate",
    "SlipGajiResponse",
    # Keuangan
    "PiutangCreate",
    "PiutangResponse",
    "PembayaranPiutangCreate",
    "KasBankCreate",
    "KasBankResponse",
]
