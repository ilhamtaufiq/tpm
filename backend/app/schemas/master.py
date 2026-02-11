from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field, EmailStr, field_validator


# ============================================
# SUPPLIER SCHEMAS
# ============================================

class SupplierBase(BaseModel):
    """Base supplier schema with common fields."""

    nama: str = Field(..., min_length=2, max_length=100)
    alamat: Optional[str] = None
    kota: Optional[str] = Field(None, max_length=50)
    telepon: Optional[str] = Field(None, max_length=20)
    email: Optional[EmailStr] = None

    @field_validator("email", mode="before")
    @classmethod
    def empty_string_to_none(cls, v):
        if isinstance(v, str) and v.strip() == "":
            return None
        return v

    contact_person: Optional[str] = Field(None, max_length=100)
    npwp: Optional[str] = Field(None, max_length=30)
    bank: Optional[str] = Field(None, max_length=50)
    rekening: Optional[str] = Field(None, max_length=50)
    catatan: Optional[str] = None


class SupplierCreate(SupplierBase):
    """Schema for creating a new supplier."""

    kode: Optional[str] = Field(None, max_length=20)  # Auto-generated if not provided


class SupplierUpdate(BaseModel):
    """Schema for updating a supplier."""

    nama: Optional[str] = Field(None, min_length=2, max_length=100)
    alamat: Optional[str] = None
    kota: Optional[str] = Field(None, max_length=50)
    telepon: Optional[str] = Field(None, max_length=20)
    email: Optional[EmailStr] = None

    @field_validator("email", mode="before")
    @classmethod
    def empty_string_to_none(cls, v):
        if isinstance(v, str) and v.strip() == "":
            return None
        return v

    contact_person: Optional[str] = Field(None, max_length=100)
    npwp: Optional[str] = Field(None, max_length=30)
    bank: Optional[str] = Field(None, max_length=50)
    rekening: Optional[str] = Field(None, max_length=50)
    catatan: Optional[str] = None


class SupplierResponse(BaseModel):
    """Schema for supplier response."""

    id: int
    kode: str
    nama: str
    alamat: Optional[str] = None
    kota: Optional[str] = None
    telepon: Optional[str] = None
    email: Optional[str] = None
    contact_person: Optional[str] = None
    npwp: Optional[str] = None
    bank: Optional[str] = None
    rekening: Optional[str] = None
    catatan: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SupplierList(BaseModel):
    """Schema for paginated supplier list."""

    data: List[SupplierResponse]
    total: int
    page: int
    size: int
    pages: int


# ============================================
# VEHICLE SCHEMAS
# ============================================

class VehicleBase(BaseModel):
    """Base vehicle schema."""

    plat_nomor: str = Field(..., max_length=15)
    jenis_unit: str = Field(..., max_length=50)
    catatan: Optional[str] = None


class VehicleCreate(VehicleBase):
    """Schema for creating a new vehicle."""

    pass


class VehicleResponse(VehicleBase):
    """Schema for vehicle response."""

    id: int
    customer_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ============================================
# CUSTOMER SCHEMAS
# ============================================

class CustomerBase(BaseModel):
    """Base customer schema with common fields."""

    nama: str = Field(..., min_length=2, max_length=100)
    tipe: str = Field(default="perorangan", pattern="^(perorangan|perusahaan)$")
    alamat: Optional[str] = None
    kota: Optional[str] = Field(None, max_length=50)
    telepon: Optional[str] = Field(None, max_length=20)
    email: Optional[EmailStr] = None

    @field_validator("email", mode="before")
    @classmethod
    def empty_string_to_none(cls, v):
        if isinstance(v, str) and v.strip() == "":
            return None
        return v

    npwp: Optional[str] = Field(None, max_length=30)
    catatan: Optional[str] = None


class CustomerCreate(CustomerBase):
    """Schema for creating a new customer."""

    kode: Optional[str] = Field(None, max_length=20)  # Auto-generated if not provided
    vehicles: Optional[List[VehicleCreate]] = None


class CustomerUpdate(BaseModel):
    """Schema for updating a customer."""

    nama: Optional[str] = Field(None, min_length=2, max_length=100)
    tipe: Optional[str] = Field(None, pattern="^(perorangan|perusahaan)$")
    alamat: Optional[str] = None
    kota: Optional[str] = Field(None, max_length=50)
    telepon: Optional[str] = Field(None, max_length=20)
    email: Optional[EmailStr] = None

    @field_validator("email", mode="before")
    @classmethod
    def empty_string_to_none(cls, v):
        if isinstance(v, str) and v.strip() == "":
            return None
        return v

    npwp: Optional[str] = Field(None, max_length=30)
    catatan: Optional[str] = None
    vehicles: Optional[List[VehicleCreate]] = None


class CustomerResponse(BaseModel):
    """Schema for customer response."""

    id: int
    kode: str
    nama: str
    tipe: str
    alamat: Optional[str] = None
    kota: Optional[str] = None
    telepon: Optional[str] = None
    email: Optional[str] = None
    npwp: Optional[str] = None
    catatan: Optional[str] = None
    vehicles: List[VehicleResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CustomerList(BaseModel):
    """Schema for paginated customer list."""

    data: List[CustomerResponse]
    total: int
    page: int
    size: int
    pages: int


class CustomerSummary(BaseModel):
    """Schema for customer summary with transaction history."""

    customer: CustomerResponse
    total_transaksi_bengkel: int = 0
    total_transaksi_mobil: int = 0
    total_piutang: float = 0
    sisa_piutang: float = 0
