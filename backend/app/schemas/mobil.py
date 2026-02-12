from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List

from pydantic import BaseModel, Field

from app.utils.constants import CarStatus, OwnershipType, PaymentStatus, PaymentMethod


# ============================================
# MOBIL SCHEMAS
# ============================================

class MobilBase(BaseModel):
    """Base car schema."""

    merek: str = Field(..., min_length=1, max_length=50)
    model: str = Field(..., min_length=1, max_length=50)
    tahun: int = Field(..., ge=1900, le=2100)
    warna: Optional[str] = Field(None, max_length=30)
    nomor_plat: str = Field(..., min_length=1, max_length=15)
    nomor_rangka: Optional[str] = Field(None, max_length=50)
    nomor_mesin: Optional[str] = Field(None, max_length=50)
    transmisi: Optional[str] = Field(None, max_length=20)
    bahan_bakar: Optional[str] = Field(None, max_length=20)
    kilometer: Optional[int] = Field(None, ge=0)
    catatan: Optional[str] = None


class MobilCreate(MobilBase):
    """Schema for creating car."""

    kode: Optional[str] = Field(None, max_length=20)
    harga_beli: Decimal = Field(..., ge=0)
    tipe_kepemilikan: OwnershipType = OwnershipType.TPM
    nama_investor: Optional[str] = Field(None, max_length=100)
    persentase_investor: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    nominal_investor: Decimal = Field(default=Decimal("0"), ge=0)
    harga_jual: Optional[Decimal] = Field(None, ge=0)
    tanggal_masuk: date


class MobilUpdate(BaseModel):
    """Schema for updating car."""

    merek: Optional[str] = Field(None, min_length=1, max_length=50)
    model: Optional[str] = Field(None, min_length=1, max_length=50)
    tahun: Optional[int] = Field(None, ge=1900, le=2100)
    warna: Optional[str] = Field(None, max_length=30)
    nomor_plat: Optional[str] = Field(None, min_length=1, max_length=15)
    nomor_rangka: Optional[str] = Field(None, max_length=50)
    nomor_mesin: Optional[str] = Field(None, max_length=50)
    transmisi: Optional[str] = Field(None, max_length=20)
    bahan_bakar: Optional[str] = Field(None, max_length=20)
    kilometer: Optional[int] = Field(None, ge=0)
    harga_jual: Optional[Decimal] = Field(None, ge=0)
    persentase_investor: Optional[Decimal] = Field(None, ge=0, le=100)
    nominal_investor: Optional[Decimal] = Field(None, ge=0)
    status: Optional[CarStatus] = None
    catatan: Optional[str] = None


class MobilMediaResponse(BaseModel):
    """Schema for car media response."""

    id: int
    file_path: str
    file_name: str
    file_type: str
    is_primary: bool
    urutan: int

    model_config = {"from_attributes": True}

class MobilBiayaCreate(BaseModel):
    """Schema for adding car additional cost."""
    tanggal: date
    kategori: str
    deskripsi: str
    jumlah: Decimal
    catatan: Optional[str] = None


class MobilBiayaResponse(BaseModel):
    """Schema for car additional cost response."""
    id: int
    tanggal: date
    kategori: str
    deskripsi: str
    jumlah: Decimal
    catatan: Optional[str] = None

    model_config = {"from_attributes": True}


class MobilPartServiceCreate(BaseModel):
    """Schema for adding car part/service."""
    tanggal: date
    tipe: str
    deskripsi: str
    qty: int
    harga_satuan: Decimal
    catatan: Optional[str] = None


class MobilPartServiceResponse(BaseModel):
    """Schema for car part/service response."""
    id: int
    tanggal: date
    tipe: str
    deskripsi: str
    qty: int
    harga_satuan: Decimal
    total: Decimal
    catatan: Optional[str] = None

    model_config = {"from_attributes": True}

class MobilResponse(BaseModel):
    """Schema for car response."""

    id: int
    kode: str
    merek: str
    model: str
    tahun: int
    warna: Optional[str] = None
    nomor_plat: str
    nomor_rangka: Optional[str] = None
    nomor_mesin: Optional[str] = None
    transmisi: Optional[str] = None
    bahan_bakar: Optional[str] = None
    kilometer: Optional[int] = None
    harga_beli: Decimal
    harga_jual: Optional[Decimal] = None
    tipe_kepemilikan: OwnershipType
    nama_investor: Optional[str] = None
    persentase_investor: Decimal
    nominal_investor: Decimal
    status: CarStatus
    tanggal_masuk: date
    tanggal_terjual: Optional[date] = None
    total_biaya: Decimal
    total_part_service: Decimal
    total_modal: Decimal
    catatan: Optional[str] = None
    media: List[MobilMediaResponse] = []
    biaya_lainnya: List[MobilBiayaResponse] = []
    part_services: List[MobilPartServiceResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MobilList(BaseModel):
    """Schema for paginated car list."""

    data: List[MobilResponse]
    total: int
    page: int
    size: int
    pages: int


# ============================================
# SHARED TRANSACTION ITEMS
# ============================================

class BiayaItem(BaseModel):
    """Schema for dynamic operational cost item."""
    id: Optional[int] = None
    deskripsi: str = Field(..., min_length=1, max_length=255)
    jumlah: Decimal = Field(..., ge=0)




# ============================================
# TRANSAKSI PENJUALAN MOBIL SCHEMAS
# ============================================

class TransaksiMobilCreate(BaseModel):
    """Schema for creating car sale transaction."""

    tanggal: date
    mobil_id: int
    customer_id: Optional[int] = None
    nama_pembeli: str = Field(..., min_length=2, max_length=100)
    telepon_pembeli: Optional[str] = Field(None, max_length=20)
    alamat_pembeli: Optional[str] = None
    harga_jual: Decimal = Field(..., ge=0)
    dp: Decimal = Field(default=Decimal("0"), ge=0)
    metode_bayar: PaymentMethod = PaymentMethod.TUNAI
    
    # Dynamic operational costs added at sale
    biaya_operasional: List[BiayaItem] = []
    

    
    catatan: Optional[str] = None


class TransaksiMobilResponse(BaseModel):
    """Schema for car sale transaction response."""

    id: int
    nomor_transaksi: str
    tanggal: date
    mobil_id: int
    mobil_info: Optional[str] = None  # "Merek Model (Plat)"
    customer_id: Optional[int] = None
    nama_pembeli: str
    telepon_pembeli: Optional[str] = None
    alamat_pembeli: Optional[str] = None
    harga_jual: Decimal
    total_modal: Decimal
    laba_kotor: Decimal
    tipe_kepemilikan: OwnershipType
    persentase_investor: Decimal
    laba_investor: Decimal
    laba_tpm: Decimal
    status_bayar: PaymentStatus
    metode_bayar: PaymentMethod
    dp: Decimal
    sisa_bayar: Decimal
    catatan: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TransaksiMobilList(BaseModel):
    """Schema for paginated car sale list."""

    data: List[TransaksiMobilResponse]
    total: int
    page: int
    size: int
    pages: int
