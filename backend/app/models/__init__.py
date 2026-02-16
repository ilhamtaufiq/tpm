from app.models.user import User
from app.models.supplier import Supplier
from app.models.customer import Customer
from app.models.bengkel import (
    SparePart,
    PembelianSparePart,
    TransaksiPenjualanBengkel,
    DetailTransaksiSpareParts,
    DetailTransaksiServices,
    PengeluaranBengkel,
    JasaServis,
)
from app.models.mobil import (
    Mobil,
    MobilMedia,
    MobilBiayaLainnya,
    MobilPartService,
    TransaksiPenjualanMobil,
)
from app.models.jasa_angkut import (
    Supir,
    MuatanJasaAngkut,
    JasaAngkutBiayaLainnya,
    JasaAngkutPartService,
)
from app.models.karyawan import (
    Karyawan,
    Absensi,
    SlipGaji,
    KasbonKaryawan,
)
from app.models.keuangan import (
    PiutangUsaha,
    PembayaranPiutang,
    HutangUsaha,
    PembayaranHutang,
    KasBank,
)

__all__ = [
    "User",
    "Supplier",
    "Customer",
    "SparePart",
    "PembelianSparePart",
    "TransaksiPenjualanBengkel",
    "DetailTransaksiSpareParts",
    "DetailTransaksiServices",
    "PengeluaranBengkel",
    "JasaServis",
    "Mobil",
    "MobilMedia",
    "MobilBiayaLainnya",
    "MobilPartService",
    "TransaksiPenjualanMobil",
    "Supir",
    "MuatanJasaAngkut",
    "JasaAngkutBiayaLainnya",
    "JasaAngkutPartService",
    "Karyawan",
    "Absensi",
    "SlipGaji",
    "KasbonKaryawan",
    "PiutangUsaha",
    "PembayaranPiutang",
    "HutangUsaha",
    "PembayaranHutang",
    "KasBank",
]
