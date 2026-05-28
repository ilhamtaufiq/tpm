from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List

from pydantic import BaseModel, Field

from app.utils.constants import PaymentStatus, PaymentMethod, MuatanStatus, KasBankJenis
from app.schemas.keuangan import PaymentDetail, PembayaranPiutangResponse
from app.schemas.bengkel import PengeluaranBengkelResponse


# ============================================
# ARMADA (VEHICLE) SCHEMAS
# ============================================

class ArmadaBase(BaseModel):
    """Base armada schema."""

    nama: str = Field(..., min_length=2, max_length=100)
    nopol: str = Field(..., min_length=2, max_length=20)
    jenis: Optional[str] = Field(None, max_length=50)
    is_active: bool = True
    catatan: Optional[str] = None


class ArmadaCreate(ArmadaBase):
    """Schema for creating armada."""
    pass


class ArmadaExpenseCreate(BaseModel):
    """Schema for adding an expense to an armada."""
    tanggal: date
    kategori: str = "Operasional"
    deskripsi: str = Field(..., min_length=1, max_length=255)
    jumlah: Decimal = Field(..., ge=0)
    catatan: Optional[str] = None
    metode_bayar: Optional[PaymentMethod] = PaymentMethod.TUNAI
    kas_jenis: Optional[KasBankJenis] = None
    payments: Optional[List[PaymentDetail]] = None



class ArmadaUpdate(BaseModel):
    """Schema for updating armada."""

    nama: Optional[str] = Field(None, min_length=2, max_length=100)
    nopol: Optional[str] = Field(None, min_length=2, max_length=20)
    jenis: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None
    catatan: Optional[str] = None


class ArmadaResponse(ArmadaBase):
    """Schema for armada response."""

    id: int
    is_ready: Optional[bool] = True  # Calculated field
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ArmadaList(BaseModel):
    """Schema for paginated armada list."""

    data: List[ArmadaResponse]
    total: int
    page: int
    size: int
    pages: int


# ============================================
# SUPIR (DRIVER) SCHEMAS
# ============================================

class SupirBase(BaseModel):
    """Base driver schema."""

    nama: str = Field(..., min_length=2, max_length=100)
    nik: Optional[str] = Field(None, max_length=20)
    alamat: Optional[str] = None
    telepon: Optional[str] = Field(None, max_length=20)
    nomor_sim: Optional[str] = Field(None, max_length=30)
    jenis_sim: Optional[str] = Field(None, max_length=10)
    nopol_kendaraan: Optional[str] = Field(None, max_length=20)
    info_kendaraan: Optional[str] = Field(None, max_length=255)
    catatan: Optional[str] = None


class SupirCreate(SupirBase):
    """Schema for creating driver."""

    kode: Optional[str] = Field(None, max_length=20)
    tanggal_bergabung: date
    armada_default_id: Optional[int] = None


class SupirUpdate(BaseModel):
    """Schema for updating driver."""

    nama: Optional[str] = Field(None, min_length=2, max_length=100)
    nik: Optional[str] = Field(None, max_length=20)
    alamat: Optional[str] = None
    telepon: Optional[str] = Field(None, max_length=20)
    nomor_sim: Optional[str] = Field(None, max_length=30)
    jenis_sim: Optional[str] = Field(None, max_length=10)
    nopol_kendaraan: Optional[str] = Field(None, max_length=20)
    info_kendaraan: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None
    catatan: Optional[str] = None


class SupirResponse(BaseModel):
    """Schema for driver response."""

    id: int
    kode: str
    nama: str
    nik: Optional[str] = None
    alamat: Optional[str] = None
    telepon: Optional[str] = None
    nomor_sim: Optional[str] = None
    jenis_sim: Optional[str] = None
    nopol_kendaraan: Optional[str] = None
    info_kendaraan: Optional[str] = None
    armada_default_id: Optional[int] = None
    armada_default: Optional[ArmadaResponse] = None
    tanggal_bergabung: date
    is_active: bool
    catatan: Optional[str] = None
    is_ready: Optional[bool] = True
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SupirList(BaseModel):
    """Schema for paginated driver list."""

    data: List[SupirResponse]
    total: int
    page: int
    size: int
    pages: int

    total_piutang: Decimal = Decimal("0")


# ============================================
# MUATAN JASA ANGKUT SCHEMAS
# ============================================

class BiayaItem(BaseModel):
    """Schema for dynamic operational cost item."""
    id: Optional[int] = None # For updates
    deskripsi: str = Field(..., min_length=1, max_length=255)
    jumlah: Decimal = Field(..., ge=0)


class BiayaTambahanResponse(BaseModel):
    """Schema for additional cost response."""
    id: int
    kategori: str
    deskripsi: str
    jumlah: Decimal
    model_config = {"from_attributes": True}


class PartServiceResponse(BaseModel):
    """Schema for part/service cost response (from linked bengkel transactions)."""
    id: int
    tanggal: date
    tipe: str  # 'part' or 'service'
    deskripsi: str
    qty: int
    harga_satuan: Decimal
    total: Decimal
    catatan: Optional[str] = None
    model_config = {"from_attributes": True}

class MuatanCreate(BaseModel):
    """Schema for creating transport load."""

    tanggal: date
    supir_id: Optional[int] = None
    supir_nama: Optional[str] = Field(None, max_length=1000)
    armada_id: Optional[int] = None
    nopol: Optional[str] = Field(None, max_length=20)
    info_kendaraan: Optional[str] = Field(None, max_length=1000)
    asal: str = Field(..., min_length=2, max_length=1000)
    tujuan: str = Field(..., min_length=2, max_length=1000)
    jenis_muatan: Optional[str] = Field(None, max_length=1000)
    ritase: int = Field(default=1, ge=1)
    berat_muatan: Optional[str] = Field(None, max_length=1000)
    
    # Trading values
    harga_beli: Decimal = Field(default=Decimal("0"), ge=0)
    harga_jual: Decimal = Field(default=Decimal("0"), ge=0)
    
    # Calculated on backend
    pendapatan_kotor: Optional[Decimal] = Field(None, ge=0)

    # Dynamic operational costs
    biaya_operasional: List[BiayaItem] = []
    
    # Legacy fields (kept for backward compatibility but default to 0)
    biaya_bbm: Decimal = Field(default=Decimal("0"), ge=0)
    biaya_tol: Decimal = Field(default=Decimal("0"), ge=0)
    biaya_makan: Decimal = Field(default=Decimal("0"), ge=0)
    biaya_parkir: Decimal = Field(default=Decimal("0"), ge=0)
    biaya_lainnya: Decimal = Field(default=Decimal("0"), ge=0)
    
    persentase_tpm: Decimal = Field(default=Decimal("100"), ge=0, le=100)
    status: Optional[MuatanStatus] = MuatanStatus.PROSES
    status_bayar: Optional[PaymentStatus] = PaymentStatus.BELUM_LUNAS
    metode_bayar: Optional[PaymentMethod] = PaymentMethod.TUNAI
    kas_jenis: Optional[KasBankJenis] = None
    payments: Optional[List[PaymentDetail]] = None
    catatan: Optional[str] = None


class MuatanUpdate(BaseModel):
    """Schema for updating transport load."""

    tanggal: Optional[date] = None
    supir_id: Optional[int] = None
    supir_nama: Optional[str] = Field(None, max_length=100)
    armada_id: Optional[int] = None
    nopol: Optional[str] = Field(None, max_length=20)
    info_kendaraan: Optional[str] = Field(None, max_length=255)
    asal: Optional[str] = Field(None, min_length=2, max_length=1000)
    tujuan: Optional[str] = Field(None, min_length=2, max_length=1000)
    jenis_muatan: Optional[str] = Field(None, max_length=1000)
    ritase: Optional[int] = Field(None, ge=1)
    berat_muatan: Optional[str] = Field(None, max_length=50)
    
    harga_beli: Optional[Decimal] = Field(None, ge=0)
    harga_jual: Optional[Decimal] = Field(None, ge=0)
    pendapatan_kotor: Optional[Decimal] = Field(None, ge=0)

    # Dynamic operational costs
    biaya_operasional: Optional[List[BiayaItem]] = None
    
    # Legacy fields
    biaya_bbm: Optional[Decimal] = Field(None, ge=0)
    biaya_tol: Optional[Decimal] = Field(None, ge=0)
    biaya_makan: Optional[Decimal] = Field(None, ge=0)
    biaya_parkir: Optional[Decimal] = Field(None, ge=0)
    biaya_lainnya: Optional[Decimal] = Field(None, ge=0)
    
    persentase_tpm: Optional[Decimal] = None
    status: Optional[MuatanStatus] = None
    status_bayar: Optional[PaymentStatus] = None
    metode_bayar: Optional[PaymentMethod] = None
    payments: Optional[List[PaymentDetail]] = None
    kas_jenis: Optional[KasBankJenis] = None
    catatan: Optional[str] = None


class MuatanResponse(BaseModel):
    """Schema for transport load response."""

    id: int
    nomor_transaksi: str
    tanggal: date
    supir_id: Optional[int] = None
    supir: Optional[SupirResponse] = None # Full driver object
    supir_nama: Optional[str] = None
    supir_nama_manual: Optional[str] = None
    armada_id: Optional[int] = None
    armada: Optional[ArmadaResponse] = None
    nopol: Optional[str] = None
    info_kendaraan: Optional[str] = None
    asal: str
    tujuan: str
    jenis_muatan: Optional[str] = None
    ritase: int
    berat_muatan: Optional[str] = None
    
    harga_beli: Decimal
    harga_jual: Decimal
    pendapatan_kotor: Decimal
    
    biaya_bbm: Decimal
    biaya_tol: Decimal
    biaya_makan: Decimal
    biaya_parkir: Decimal
    biaya_lainnya: Decimal
    total_biaya: Decimal
    laba_kotor: Decimal
    persentase_tpm: Decimal
    laba_tpm: Decimal
    laba_supir: Decimal
    status: MuatanStatus
    status_bayar: PaymentStatus
    tanggal_bayar: Optional[date] = None
    biaya_tambahan: List[BiayaTambahanResponse] = []
    part_services: List[PartServiceResponse] = []
    piutang_id: Optional[int] = None
    jumlah_bayar: Decimal = Decimal("0")
    payment_history: List[PembayaranPiutangResponse] = []
    catatan: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MuatanPaymentSplit(BaseModel):
    """Schema for split payment of transport load."""
    muatan_id: int
    tanggal: date
    payments: List[PaymentDetail]
    catatan: Optional[str] = None


class MuatanList(BaseModel):
    """Schema for paginated transport load list."""

    data: List[MuatanResponse]
    total: int
    page: int
    size: int
    pages: int
from app.schemas.bengkel import TransaksiBengkelResponse


class ArmadaStats(BaseModel):
    """Aggregated stats for armada."""
    total_muatan: int = 0
    total_ritase: int = 0
    total_pendapatan_kotor: Decimal = Decimal("0")
    total_biaya_operasional: Decimal = Decimal("0")
    total_perbaikan_bengkel: Decimal = Decimal("0")
    total_laba_tpm: Decimal = Decimal("0")


class ArmadaDetailResponse(BaseModel):
    """Detailed response for armada including history and stats."""
    armada: ArmadaResponse
    stats: ArmadaStats
    muatan_history: List[MuatanResponse]
    perbaikan_history: List[TransaksiBengkelResponse]
    general_expenses: List[BiayaTambahanResponse] = []
    workshop_expenses: List[PengeluaranBengkelResponse] = []


    model_config = {"from_attributes": True}
