from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List

from pydantic import BaseModel, Field

from app.utils.constants import PaymentStatus, PaymentMethod, ExpenseCategory, WorkshopStatus


# ============================================
# SPARE PART SCHEMAS
# ============================================

class SparePartBase(BaseModel):
    """Base spare part schema."""

    nama: str = Field(..., min_length=2, max_length=150)
    kategori: Optional[str] = Field(None, max_length=50)
    merek: Optional[str] = Field(None, max_length=50)
    satuan: str = Field(default="pcs", max_length=20)
    stok_minimum: int = Field(default=5, ge=0)
    harga_beli: Decimal = Field(default=Decimal("0"), ge=0)
    harga_jual: Decimal = Field(default=Decimal("0"), ge=0)
    lokasi_rak: Optional[str] = Field(None, max_length=30)
    catatan: Optional[str] = None


class SparePartCreate(SparePartBase):
    """Schema for creating spare part."""

    kode: Optional[str] = Field(None, max_length=30)  # Auto-generated if not provided
    stok: int = Field(default=0, ge=0)


class SparePartUpdate(BaseModel):
    """Schema for updating spare part."""

    nama: Optional[str] = Field(None, min_length=2, max_length=150)
    kategori: Optional[str] = Field(None, max_length=50)
    merek: Optional[str] = Field(None, max_length=50)
    satuan: Optional[str] = Field(None, max_length=20)
    stok_minimum: Optional[int] = Field(None, ge=0)
    harga_beli: Optional[Decimal] = Field(None, ge=0)
    harga_jual: Optional[Decimal] = Field(None, ge=0)
    lokasi_rak: Optional[str] = Field(None, max_length=30)
    catatan: Optional[str] = None
    stok: Optional[int] = Field(None, ge=0)


class SparePartResponse(BaseModel):
    """Schema for spare part response."""

    id: int
    kode: str
    nama: str
    kategori: Optional[str] = None
    merek: Optional[str] = None
    satuan: str
    stok: int
    stok_minimum: int
    harga_beli: Decimal
    harga_jual: Decimal
    lokasi_rak: Optional[str] = None
    catatan: Optional[str] = None
    is_low_stock: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SparePartList(BaseModel):
    """Schema for paginated spare part list."""

    data: List[SparePartResponse]
    total: int
    page: int
    size: int
    pages: int


# ============================================
# JASA SERVIS SCHEMAS
# ============================================

class JasaServisBase(BaseModel):
    """Base workshop service schema."""

    nama: str = Field(..., min_length=2, max_length=150)
    kategori: Optional[str] = Field(None, max_length=50)
    harga: Decimal = Field(default=Decimal("0"), ge=0)
    deskripsi: Optional[str] = None


class JasaServisCreate(JasaServisBase):
    """Schema for creating workshop service."""
    pass


class JasaServisUpdate(BaseModel):
    """Schema for updating workshop service."""

    nama: Optional[str] = Field(None, min_length=2, max_length=150)
    kategori: Optional[str] = Field(None, max_length=50)
    harga: Optional[Decimal] = Field(None, ge=0)
    deskripsi: Optional[str] = None


class JasaServisResponse(JasaServisBase):
    """Schema for workshop service response."""

    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class JasaServisList(BaseModel):
    """Schema for paginated workshop service list."""

    data: List[JasaServisResponse]
    total: int
    page: int
    size: int
    pages: int


# ============================================
# PEMBELIAN SPARE PART SCHEMAS
# ============================================

class DetailPembelianCreate(BaseModel):
    """Schema for purchase detail item."""

    spare_part_id: int
    qty: int = Field(..., gt=0)
    harga_satuan: Decimal = Field(..., ge=0)


class PembelianSparePartCreate(BaseModel):
    """Schema for creating spare part purchase."""

    tanggal: date
    supplier_id: int
    nomor_faktur: Optional[str] = Field(None, max_length=50)
    detail: List[DetailPembelianCreate] = Field(..., min_length=1)
    diskon: Decimal = Field(default=Decimal("0"), ge=0)
    metode_bayar: Optional[PaymentMethod] = None
    catatan: Optional[str] = None


class DetailPembelianResponse(BaseModel):
    """Schema for purchase detail response."""

    id: int
    spare_part_id: int
    spare_part_nama: Optional[str] = None
    spare_part: Optional['SparePartResponse'] = None
    qty: int
    harga_satuan: Decimal
    subtotal: Decimal

    model_config = {"from_attributes": True}


class PembelianSparePartResponse(BaseModel):
    """Schema for purchase response."""

    id: int
    nomor_transaksi: str
    tanggal: date
    supplier_id: int
    supplier_nama: Optional[str] = None
    nomor_faktur: Optional[str] = None
    total: Decimal
    diskon: Decimal
    grand_total: Decimal
    status_bayar: PaymentStatus
    metode_bayar: Optional[PaymentMethod] = None
    tanggal_bayar: Optional[date] = None
    catatan: Optional[str] = None
    detail: List[DetailPembelianResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


# ============================================
# TRANSAKSI BENGKEL SCHEMAS
# ============================================

class PaymentItem(BaseModel):
    """Schema for split payment item."""
    metode: PaymentMethod
    jumlah: Decimal = Field(..., ge=0)

class DetailPartCreate(BaseModel):
    """Schema for transaction part item."""

    spare_part_id: int
    qty: int = Field(..., gt=0)
    harga_jual: Optional[Decimal] = None  # Use default from spare_part if None


class DetailServiceCreate(BaseModel):
    """Schema for transaction service item."""

    nama_jasa: str = Field(..., min_length=2, max_length=150)
    deskripsi: Optional[str] = None
    harga: Decimal = Field(..., ge=0)
    qty: int = Field(default=1, gt=0)


class TransaksiBengkelCreate(BaseModel):
    """Schema for creating workshop transaction."""

    tanggal: date
    customer_id: Optional[int] = None
    nama_customer: Optional[str] = Field(None, max_length=100)
    nomor_plat: Optional[str] = Field(None, max_length=15)
    jenis_kendaraan: Optional[str] = Field(None, max_length=50)
    kategori: str = Field(default="umum", pattern="^(umum|jasa_angkut|jual_beli_mobil)$")
    muatan_id: Optional[int] = None
    mobil_id: Optional[int] = None
    detail_parts: List[DetailPartCreate] = []
    detail_services: List[DetailServiceCreate] = []
    diskon: Decimal = Field(default=Decimal("0"), ge=0)
    metode_bayar: PaymentMethod = PaymentMethod.TUNAI
    jumlah_bayar: Decimal = Field(default=Decimal("0"), ge=0)
    payments: List[PaymentItem] = []  # For split payments
    catatan: Optional[str] = None


class DetailPartResponse(BaseModel):
    """Schema for transaction part response."""

    id: int
    spare_part_id: int
    spare_part_nama: Optional[str] = None
    qty: int
    harga_beli: Decimal
    harga_jual: Decimal
    subtotal: Decimal

    model_config = {"from_attributes": True}


class DetailServiceResponse(BaseModel):
    """Schema for transaction service response."""

    id: int
    nama_jasa: str
    deskripsi: Optional[str] = None
    harga: Decimal
    qty: int
    subtotal: Decimal

    model_config = {"from_attributes": True}


class TransaksiBengkelResponse(BaseModel):
    """Schema for workshop transaction response."""

    id: int
    nomor_transaksi: str
    tanggal: date
    customer_id: Optional[int] = None
    nama_customer: Optional[str] = None
    nomor_plat: Optional[str] = None
    jenis_kendaraan: Optional[str] = None
    kategori: str = "umum"
    muatan_id: Optional[int] = None
    muatan_nomor: Optional[str] = None
    mobil_id: Optional[int] = None
    total_parts: Decimal
    total_jasa: Decimal
    subtotal: Decimal
    diskon: Decimal
    grand_total: Decimal
    hpp_parts: Decimal
    laba_kotor: Decimal
    status_pengerjaan: WorkshopStatus
    status_bayar: PaymentStatus
    metode_bayar: PaymentMethod
    jumlah_bayar: Decimal
    kembalian: Decimal
    # Aliases for frontend compatibility
    total_biaya: Decimal
    total_part: Decimal
    customer_nama: Optional[str] = None
    plat_nomor: Optional[str] = None
    catatan: Optional[str] = None
    detail_parts: List[DetailPartResponse] = []
    detail_services: List[DetailServiceResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}
    
class TransaksiBengkelList(BaseModel):
    """Schema for paginated workshop transaction list."""
    data: List[TransaksiBengkelResponse]
    total: int
    page: int
    size: int
    pages: int


class PaymentUpdate(BaseModel):
    """Schema for adding payment to transaction."""
    jumlah_bayar: Decimal = Field(..., ge=0)
    metode_bayar: Optional[PaymentMethod] = None


# ============================================
# PENGELUARAN BENGKEL SCHEMAS
# ============================================

class PengeluaranBengkelCreate(BaseModel):
    """Schema for creating workshop expense."""

    tanggal: date
    kategori: ExpenseCategory = ExpenseCategory.BIAYA_OPERASIONAL
    deskripsi: str = Field(..., min_length=2, max_length=255)
    jumlah: Decimal = Field(..., gt=0)
    metode_bayar: PaymentMethod = PaymentMethod.TUNAI
    catatan: Optional[str] = None


class PengeluaranBengkelUpdate(BaseModel):
    """Schema for updating workshop expense."""

    tanggal: Optional[date] = None
    kategori: Optional[ExpenseCategory] = None
    deskripsi: Optional[str] = Field(None, min_length=2, max_length=255)
    jumlah: Optional[Decimal] = Field(None, gt=0)
    metode_bayar: Optional[PaymentMethod] = None
    catatan: Optional[str] = None


class PengeluaranBengkelResponse(BaseModel):
    """Schema for workshop expense response."""

    id: int
    nomor_transaksi: str
    tanggal: date
    kategori: ExpenseCategory
    deskripsi: str
    jumlah: Decimal
    metode_bayar: PaymentMethod
    catatan: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PengeluaranListResponse(BaseModel):
    """Schema for paginated workshop expense list."""

    data: List[PengeluaranBengkelResponse]
    total: int
    page: int
    size: int
    pages: int
