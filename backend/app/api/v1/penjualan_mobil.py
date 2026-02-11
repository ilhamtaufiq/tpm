from typing import Optional
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Query, status

from app.api.deps import DBSession, CurrentUser, ManagerUser
from app.schemas.mobil import (
    TransaksiMobilCreate,
    TransaksiMobilResponse,
)
from app.services.penjualan_mobil_service import PenjualanMobilService
from app.utils.constants import PaymentStatus, OwnershipType, PaymentMethod


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
    jumlah_bayar: Decimal,
    db: DBSession,
    current_user: ManagerUser,
    metode_bayar: PaymentMethod = PaymentMethod.TUNAI,
):
    """Process payment for transaction."""
    service = PenjualanMobilService(db)
    return service.update_payment(transaksi_id, jumlah_bayar, metode_bayar, current_user.id)
