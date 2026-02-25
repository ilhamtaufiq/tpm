from datetime import date, time, datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field

from app.utils.constants import (
    AttendanceStatus,
    EmployeeStatus,
    PaymentStatus,
    PaymentMethod,
)


# ============================================
# KARYAWAN (EMPLOYEE) SCHEMAS
# ============================================

class KaryawanBase(BaseModel):
    """Base employee schema."""

    nama: str = Field(..., min_length=2, max_length=100)
    nik: Optional[str] = Field(None, max_length=20)
    jabatan: str = Field(..., min_length=2, max_length=50)
    alamat: Optional[str] = None
    telepon: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    tanggal_lahir: Optional[date] = None
    gaji_pokok: Decimal = Field(default=Decimal("0"), ge=0)
    tunjangan: Decimal = Field(default=Decimal("0"), ge=0)
    catatan: Optional[str] = None


class KaryawanCreate(KaryawanBase):
    """Schema for creating employee."""

    kode: Optional[str] = Field(None, max_length=20)
    tanggal_bergabung: date


class KaryawanUpdate(BaseModel):
    """Schema for updating employee."""

    nama: Optional[str] = Field(None, min_length=2, max_length=100)
    nik: Optional[str] = Field(None, max_length=20)
    jabatan: Optional[str] = Field(None, min_length=2, max_length=50)
    alamat: Optional[str] = None
    telepon: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    tanggal_lahir: Optional[date] = None
    gaji_pokok: Optional[Decimal] = Field(None, ge=0)
    tunjangan: Optional[Decimal] = Field(None, ge=0)
    status: Optional[EmployeeStatus] = None
    tanggal_keluar: Optional[date] = None
    catatan: Optional[str] = None


class KaryawanResponse(BaseModel):
    """Schema for employee response."""

    id: int
    kode: str
    nama: str
    nik: Optional[str] = None
    jabatan: str
    alamat: Optional[str] = None
    telepon: Optional[str] = None
    email: Optional[str] = None
    tanggal_lahir: Optional[date] = None
    tanggal_bergabung: date
    tanggal_keluar: Optional[date] = None
    gaji_pokok: Decimal
    tunjangan: Decimal
    total_gaji: Decimal
    status: EmployeeStatus
    catatan: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class KaryawanList(BaseModel):
    """Schema for paginated employee list."""

    data: List[KaryawanResponse]
    total: int
    page: int
    size: int
    pages: int


class KaryawanSummary(BaseModel):
    """Schema for employee summary with statistics."""

    karyawan: KaryawanResponse
    total_kasbon_aktif: Decimal = Decimal("0")
    jumlah_hadir_bulan_ini: int = 0
    jumlah_hari_kerja_bulan_ini: int = 0


# ============================================
# ABSENSI (ATTENDANCE) SCHEMAS
# ============================================

class AbsensiCreate(BaseModel):
    """Schema for creating attendance."""

    karyawan_id: int
    tanggal: date
    status: AttendanceStatus = AttendanceStatus.HADIR
    jam_masuk: Optional[time] = None
    jam_keluar: Optional[time] = None
    catatan: Optional[str] = None


class AbsensiBulkCreate(BaseModel):
    """Schema for bulk attendance creation."""

    tanggal: date
    items: List[AbsensiCreate]


class AbsensiUpdate(BaseModel):
    """Schema for updating attendance."""

    status: Optional[AttendanceStatus] = None
    jam_masuk: Optional[time] = None
    jam_keluar: Optional[time] = None
    catatan: Optional[str] = None


class AbsensiResponse(BaseModel):
    """Schema for attendance response."""

    id: int
    karyawan_id: int
    karyawan_nama: Optional[str] = None
    tanggal: date
    status: AttendanceStatus
    jam_masuk: Optional[time] = None
    jam_keluar: Optional[time] = None
    jam_kerja: Optional[float] = None
    is_late: bool = False
    catatan: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AbsensiSummary(BaseModel):
    """Schema for monthly attendance summary."""

    karyawan_id: int
    karyawan_nama: str
    periode_bulan: int
    periode_tahun: int
    total_hari_kerja: int
    jumlah_hadir: float
    jumlah_setengah_hari: int = 0
    jumlah_izin: int
    jumlah_sakit: int
    jumlah_alpha: int
    jumlah_cuti: int
    persentase_kehadiran: float


# ============================================
# SLIP GAJI (WEEKLY PAYROLL) SCHEMAS
# ============================================

class SlipGajiCreate(BaseModel):
    """Schema for creating weekly salary slip."""

    karyawan_id: int
    periode_minggu: int = Field(..., ge=1, le=53)
    periode_tahun: int = Field(..., ge=2000, le=2100)
    potongan_kasbon: Optional[Decimal] = Field(default=Decimal("0"), ge=0)


class SlipGajiUpdate(BaseModel):
    """Schema for updating salary slip payment."""

    metode_bayar: PaymentMethod
    catatan: Optional[str] = None


class SlipGajiResponse(BaseModel):
    """Schema for weekly salary slip response."""

    id: int
    nomor_slip: str
    karyawan_id: int
    karyawan_nama: Optional[str] = None
    periode_minggu: int
    periode_tahun: int
    tanggal_mulai: date
    tanggal_akhir: date
    jumlah_hadir: float
    gaji_pokok: Decimal
    potongan_kasbon: Decimal
    gaji_bersih: Decimal
    status: PaymentStatus
    metode_bayar: Optional[PaymentMethod] = None
    tanggal_bayar: Optional[date] = None
    catatan: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SlipGajiList(BaseModel):
    """Schema for paginated salary slip list."""

    data: List[SlipGajiResponse]
    total: int
    page: int
    size: int
    pages: int


class SlipGajiWeeklySummary(BaseModel):
    """Schema for weekly payroll summary."""

    periode_minggu: int
    periode_tahun: int
    tanggal_mulai: date
    tanggal_akhir: date
    total_karyawan: int
    total_gaji_pokok: Decimal
    total_potongan_kasbon: Decimal
    total_gaji_bersih: Decimal
    total_dibayar: Decimal
    total_belum_dibayar: Decimal


# ============================================
# KASBON KARYAWAN SCHEMAS
# ============================================


class KasbonCreate(BaseModel):
    """Schema for creating employee advance."""

    karyawan_id: int
    tanggal: date
    nominal: Decimal = Field(..., gt=0)
    keterangan: Optional[str] = None
    catatan: Optional[str] = None
    payments: Optional[List[Dict[str, Any]]] = None # For split disbursement: {metode: PaymentMethod, nominal: Decimal, catatan: str}


class KasbonPaymentSplit(BaseModel):
    """Schema for split payment of kasbon."""

    payments: List[Dict[str, Any]] # List of {metode: PaymentMethod, nominal: Decimal, catatan: str}
    catatan: Optional[str] = None



class KasbonResponse(BaseModel):
    """Schema for employee advance response."""

    id: int
    nomor_kasbon: str
    karyawan_id: int
    karyawan_nama: Optional[str] = None
    tanggal: date
    nominal: Decimal
    keterangan: Optional[str] = None
    status: PaymentStatus
    piutang_id: Optional[int] = None
    jumlah_bayar: Decimal = Decimal("0")
    tanggal_lunas: Optional[date] = None
    catatan: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class KasbonList(BaseModel):
    """Schema for paginated kasbon list."""

    data: List[KasbonResponse]
    total: int
    page: int
    size: int
    pages: int
