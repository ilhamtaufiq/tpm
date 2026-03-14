from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List

from pydantic import BaseModel, Field

from app.utils.constants import CarStatus, OwnershipType, PaymentStatus, PaymentMethod, InvestorDisbursementStatus


# ============================================
# MOBIL SCHEMAS
# ============================================

class MobilBase(BaseModel):
    merek: str = Field(..., min_length=1, max_length=50)
    model: str = Field(..., min_length=1, max_length=50)
    tahun: int = Field(..., ge=1900, le=2100)
    warna: Optional[str] = Field(None, max_length=30)
    nomor_plat: str = Field(..., min_length=3, max_length=20)
    nomor_rangka: Optional[str] = Field(None, max_length=50)
    nomor_mesin: Optional[str] = Field(None, max_length=50)
    tipe_kepemilikan: OwnershipType = OwnershipType.TPM
    nama_investor: Optional[str] = Field(None, max_length=100)
    nominal_investor: Decimal = Field(default=Decimal("0"), ge=0)
    harga_beli: Decimal = Field(..., ge=0)
    status: CarStatus = CarStatus.TERSEDIA

class MobilCreate(MobilBase):
    pass

class MobilUpdate(BaseModel):
    merek: Optional[str] = Field(None, min_length=1, max_length=50)
    model: Optional[str] = Field(None, min_length=1, max_length=50)
    tahun: Optional[int] = Field(None, ge=1900, le=2100)
    warna: Optional[str] = Field(None, max_length=30)
    nomor_plat: Optional[str] = Field(None, min_length=3, max_length=20)
    nomor_rangka: Optional[str] = Field(None, max_length=50)
    nomor_mesin: Optional[str] = Field(None, max_length=50)
    tipe_kepemilikan: Optional[OwnershipType] = None
    nama_investor: Optional[str] = None
    nominal_investor: Optional[Decimal] = None
    harga_beli: Optional[Decimal] = None
    status: Optional[CarStatus] = None

class MobilResponse(MobilBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class BiayaItem(BaseModel):
    keterangan: str
    nominal: Decimal
    tanggal: Optional[date] = None

class PaymentItem(BaseModel):
    metode: PaymentMethod
    nominal: Decimal
    catatan: Optional[str] = None

class TransaksiMobilCreate(BaseModel):
    tanggal: date
    mobil_id: int
    customer_id: Optional[int] = None
    nama_pembeli: str = Field(..., min_length=2, max_length=100)
    telepon_pembeli: Optional[str] = Field(None, max_length=20)
    alamat_pembeli: Optional[str] = None
    harga_jual: Decimal = Field(..., ge=0)
    dp: Decimal = Field(default=Decimal("0"), ge=0)
    metode_bayar: PaymentMethod = PaymentMethod.TUNAI
    payments: List[PaymentItem] = [] # For split payments
    biaya_operasional: List[BiayaItem] = []
    catatan: Optional[str] = None


class InvestorDisbursementDetailResponse(BaseModel):
    """Schema for individual disbursement payment."""
    id: int
    tanggal: date
    nominal: Decimal
    metode_bayar: PaymentMethod
    catatan: Optional[str] = None
    created_at: datetime
    transaksi_id: Optional[int] = None
    # Use forward reference to avoid circularity if TransaksiMobilResponse is defined later
    transaksi: Optional['TransaksiMobilResponse'] = None

    model_config = {"from_attributes": True}


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
    piutang_id: Optional[int] = None
    catatan: Optional[str] = None
    status_pencairan: Optional[InvestorDisbursementStatus] = None
    tanggal_pencairan: Optional[date] = None
    nominal_pencairan: Decimal = Decimal("0")
    metode_pencairan: Optional[PaymentMethod] = None
    catatan_pencairan: Optional[str] = None
    rincian_pencairan: List[InvestorDisbursementDetailResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}

class TransaksiMobilList(BaseModel):
    data: List[TransaksiMobilResponse]
    total: int
    page: int
    size: int
    pages: int

    model_config = {"from_attributes": True}

class MobilSummary(BaseModel):
    total_unit: int
    ready_unit: int
    sold_unit: int
    total_investasi: Decimal
    total_potensi_penjualan: Decimal
    total_laba_kotor: Decimal

class MobilDetailResponse(MobilResponse):
    total_biaya: Decimal = Decimal("0")
    total_part_service: Decimal = Decimal("0")
    total_biaya_part: Decimal = Decimal("0")
    final_capital: Decimal = Decimal("0")
    is_sold: bool = False
    penjualan: Optional[TransaksiMobilResponse] = None

InvestorDisbursementDetailResponse.model_rebuild()
TransaksiMobilResponse.model_rebuild()
