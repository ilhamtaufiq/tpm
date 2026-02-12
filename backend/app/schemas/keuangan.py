from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List

from pydantic import BaseModel, Field

from app.utils.constants import (
    PiutangStatus,
    PaymentMethod,
    KasBankType,
    PiutangSource,
    KasBankSource,
    KasBankJenis,
)


# ============================================
# PIUTANG USAHA (RECEIVABLES) SCHEMAS
# ============================================

class PiutangCreate(BaseModel):
    """Schema for creating receivable."""

    tanggal: date
    sumber: PiutangSource
    referensi_id: Optional[int] = None
    nomor_referensi: Optional[str] = Field(None, max_length=30)
    customer_id: Optional[int] = None
    nama_debitur: str = Field(..., min_length=2, max_length=100)
    telepon_debitur: Optional[str] = Field(None, max_length=20)
    alamat_debitur: Optional[str] = None
    nominal_piutang: Decimal = Field(..., gt=0)
    tanggal_jatuh_tempo: Optional[date] = None
    metode_pembayaran: Optional[PaymentMethod] = None
    catatan: Optional[str] = None


class PiutangUpdate(BaseModel):
    """Schema for updating receivable."""

    tanggal_jatuh_tempo: Optional[date] = None
    catatan: Optional[str] = None


class PiutangResponse(BaseModel):
    """Schema for receivable response."""

    id: int
    nomor_piutang: str
    tanggal: date
    sumber: PiutangSource
    referensi_id: Optional[int] = None
    nomor_referensi: Optional[str] = None
    customer_id: Optional[int] = None
    nama_debitur: str
    telepon_debitur: Optional[str] = None
    alamat_debitur: Optional[str] = None
    nominal_piutang: Decimal
    total_dibayar: Decimal
    sisa_piutang: Decimal
    persentase_terbayar: float
    tanggal_jatuh_tempo: Optional[date] = None
    tanggal_lunas: Optional[date] = None
    status: PiutangStatus
    is_overdue: bool = False
    catatan: Optional[str] = None
    pembayaran: List["PembayaranPiutangResponse"] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class PiutangList(BaseModel):
    """Schema for paginated receivable list."""

    data: List[PiutangResponse]
    total: int
    page: int
    size: int
    pages: int
    total_piutang: Decimal = Decimal("0")
    total_terbayar: Decimal = Decimal("0")
    total_sisa: Decimal = Decimal("0")


class PiutangSummary(BaseModel):
    """Schema for receivable summary."""

    total_piutang: Decimal
    total_terbayar: Decimal
    total_sisa: Decimal
    jumlah_lunas: int
    jumlah_belum_lunas: int
    jumlah_overdue: int
    by_sumber: dict


# ============================================
# PEMBAYARAN PIUTANG SCHEMAS
# ============================================

class PembayaranPiutangCreate(BaseModel):
    """Schema for creating receivable payment."""

    piutang_id: int
    tanggal: date
    nominal: Decimal = Field(..., gt=0)
    metode_bayar: PaymentMethod = PaymentMethod.TUNAI
    catatan: Optional[str] = None


class PembayaranPiutangResponse(BaseModel):
    """Schema for receivable payment response."""

    id: int
    piutang_id: int
    tanggal: date
    nominal: Decimal
    metode_bayar: PaymentMethod
    catatan: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ============================================
# KAS BANK SCHEMAS
# ============================================

class KasBankCreate(BaseModel):
    """Schema for creating cash/bank transaction."""

    tanggal: date
    jenis: KasBankJenis = KasBankJenis.CASH
    tipe: KasBankType
    nominal: Decimal = Field(..., gt=0)
    sumber: KasBankSource
    metode_bayar: Optional[PaymentMethod] = None
    referensi_id: Optional[int] = None
    nomor_referensi: Optional[str] = Field(None, max_length=30)
    keterangan: str = Field(..., min_length=2, max_length=255)
    catatan: Optional[str] = None


class KasBankResponse(BaseModel):
    """Schema for cash/bank transaction response."""

    id: int
    nomor_transaksi: str
    tanggal: date
    jenis: KasBankJenis
    tipe: KasBankType
    nominal: Decimal
    sumber: KasBankSource
    referensi_id: Optional[int] = None
    nomor_referensi: Optional[str] = None
    saldo_sebelum: Decimal
    saldo_sesudah: Decimal
    keterangan: str
    catatan: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class KasBankList(BaseModel):
    """Schema for paginated cash/bank transaction list."""

    data: List[KasBankResponse]
    total: int
    page: int
    size: int
    pages: int
    saldo_awal: Decimal = Decimal("0")
    total_masuk: Decimal = Decimal("0")
    total_keluar: Decimal = Decimal("0")
    saldo_akhir: Decimal = Decimal("0")


class KasBankSummary(BaseModel):
    """Schema for cash/bank summary."""

    jenis: KasBankJenis
    saldo: Decimal
    total_masuk_bulan_ini: Decimal
    total_keluar_bulan_ini: Decimal


class KasBankAllSummary(BaseModel):
    """Schema for all cash/bank summary."""

    cash: KasBankSummary
    bank_bca: Optional[KasBankSummary] = None
    bank_mandiri: Optional[KasBankSummary] = None
    bank_bri: Optional[KasBankSummary] = None
    total_saldo: Decimal


# Update forward reference
PiutangResponse.model_rebuild()
