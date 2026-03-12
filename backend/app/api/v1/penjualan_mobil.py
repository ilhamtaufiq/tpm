from typing import Optional, List
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Query, status
from pydantic import BaseModel, Field

from app.api.deps import DBSession, CurrentUser, ManagerUser
from app.schemas.mobil import (
    TransaksiMobilCreate,
    TransaksiMobilResponse,
)
from app.services.penjualan_mobil_service import PenjualanMobilService
from app.utils.constants import PaymentStatus, OwnershipType, PaymentMethod


class PaymentEntry(BaseModel):
    """Single payment entry for split payments."""
    metode: PaymentMethod = PaymentMethod.TUNAI
    nominal: Decimal = Field(..., gt=0)


class SplitPaymentRequest(BaseModel):
    """Schema for processing payment (supports split)."""
    jumlah_bayar: Decimal = Field(..., ge=0)
    metode_bayar: Optional[PaymentMethod] = None
    payments: List[PaymentEntry] = []


class CancelBookingRequest(BaseModel):
    """Schema for cancelling a booking."""
    penalti: Decimal = Field(default=Decimal("0"), ge=0, description="Penalty amount to deduct from DP")
    metode_refund: Optional[PaymentMethod] = PaymentMethod.TUNAI
    refund_payments: List[PaymentEntry] = []
    alasan: Optional[str] = Field(default="", max_length=500, description="Reason for cancellation")


router = APIRouter(prefix="/penjualan-mobil", tags=["Penjualan Mobil"])


@router.post("", response_model=TransaksiMobilResponse, status_code=status.HTTP_201_CREATED)
def create_transaksi(
    data: TransaksiMobilCreate,
    db: DBSession,
    current_user: ManagerUser,
):
    """Create a new car sales transaction."""
    service = PenjualanMobilService(db)
    return service.create(data, current_user.id)


@router.get("")
def list_transaksi(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    customer_id: Optional[int] = None,
    status_bayar: Optional[PaymentStatus] = None,
    tipe_kepemilikan: Optional[OwnershipType] = None,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
    sort_by: str = "tanggal",
    sort_order: str = "desc",
):
    """Get list of car sales transactions with pagination and filters."""
    service = PenjualanMobilService(db)
    return service.get_list(
        skip=skip,
        limit=limit,
        search=search,
        customer_id=customer_id,
        status_bayar=status_bayar,
        tipe_kepemilikan=tipe_kepemilikan,
        tanggal_dari=tanggal_dari,
        tanggal_sampai=tanggal_sampai,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get("/summary")
def get_summary(
    db: DBSession,
    current_user: ManagerUser,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
):
    """Get car sales summary statistics."""
    service = PenjualanMobilService(db)
    return service.get_summary(tanggal_dari, tanggal_sampai)


@router.get("/investor-report")
def get_investor_report(
    db: DBSession,
    current_user: ManagerUser,
    nama_investor: Optional[str] = None,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
):
    """Get investor profit report."""
    service = PenjualanMobilService(db)
    return service.get_investor_report(nama_investor, tanggal_dari, tanggal_sampai)


# --- Investor Disbursement Endpoints ---
# NOTE: These MUST be before /{transaksi_id} to avoid path parameter conflict

class DisbursementRequest(BaseModel):
    """Schema for processing investor disbursement."""
    metode_bayar: PaymentMethod = PaymentMethod.TUNAI
    tanggal: Optional[date] = None
    catatan: Optional[str] = ""


@router.get("/investor/pending-disbursements")
def get_pending_disbursements(
    db: DBSession,
    current_user: ManagerUser,
    nama_investor: Optional[str] = None,
):
    """Get list of investor sales pending disbursement."""
    service = PenjualanMobilService(db)
    return service.get_pending_disbursements(nama_investor)


@router.get("/investor/disbursement-summary")
def get_disbursement_summary(
    db: DBSession,
    current_user: ManagerUser,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
):
    """Get summary of investor disbursements."""
    service = PenjualanMobilService(db)
    return service.get_disbursement_summary(tanggal_dari, tanggal_sampai)


# --- Transaction-specific routes (use /{transaksi_id} path parameter) ---

@router.get("/{transaksi_id}", response_model=TransaksiMobilResponse)
def get_transaksi(
    transaksi_id: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get transaction by ID."""
    service = PenjualanMobilService(db)
    return service.get_by_id(transaksi_id)


@router.patch("/{transaksi_id}/payment", response_model=TransaksiMobilResponse)
def update_payment(
    transaksi_id: int,
    data: SplitPaymentRequest,
    db: DBSession,
    current_user: ManagerUser,
):
    """Process payment for transaction (supports split payments)."""
    service = PenjualanMobilService(db)
    # Build payment entries list
    if data.payments:
        payment_entries = [(p.metode, p.nominal) for p in data.payments]
    else:
        payment_entries = [(data.metode_bayar or PaymentMethod.TUNAI, data.jumlah_bayar)]
    return service.update_payment(transaksi_id, data.jumlah_bayar, payment_entries, current_user.id)


@router.post("/{transaksi_id}/cancel", response_model=TransaksiMobilResponse)
def cancel_booking(
    transaksi_id: int,
    data: CancelBookingRequest,
    db: DBSession,
    current_user: ManagerUser,
):
    """Cancel a booking and process penalty/refund."""
    service = PenjualanMobilService(db)
    # Build refund entries
    refund_entries = []
    if data.refund_payments:
        refund_entries = [(p.metode, p.nominal) for p in data.refund_payments]
    elif data.metode_refund:
        refund_entries = [(data.metode_refund, None)]  # None = use calculated refund
    return service.cancel_booking(
        transaksi_id=transaksi_id,
        penalti=data.penalti,
        refund_entries=refund_entries,
        alasan=data.alasan or "",
        user_id=current_user.id,
    )


@router.post("/{transaksi_id}/disburse")
def process_disbursement(
    transaksi_id: int,
    data: DisbursementRequest,
    db: DBSession,
    current_user: ManagerUser,
):
    """Process investor fund disbursement for a sold car."""
    service = PenjualanMobilService(db)
    result = service.process_disbursement(
        transaksi_id=transaksi_id,
        metode_bayar=data.metode_bayar,
        tanggal=data.tanggal,
        catatan=data.catatan or "",
        user_id=current_user.id,
    )
    return {
        "message": "Dana investor berhasil dicairkan",
        "transaksi_id": result.id,
        "nominal_pencairan": float(result.nominal_pencairan),
        "tanggal_pencairan": result.tanggal_pencairan.isoformat(),
        "status_pencairan": result.status_pencairan.value,
    }
