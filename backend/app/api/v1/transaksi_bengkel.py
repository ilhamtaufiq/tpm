from typing import Optional
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Query, status

from app.api.deps import DBSession, CurrentUser, ManagerUser, UnitManagerUser
from app.schemas.bengkel import (
    TransaksiBengkelCreate,
    TransaksiBengkelResponse,
    TransaksiBengkelList,
    PaymentUpdate,
)
from app.services.transaksi_bengkel_service import TransaksiBengkelService
from app.utils.constants import PaymentStatus, PaymentMethod, WorkshopStatus


router = APIRouter(prefix="/transaksi-bengkel", tags=["Transaksi Bengkel"])


@router.post("", response_model=TransaksiBengkelResponse, status_code=status.HTTP_201_CREATED)
def create_transaksi(
    data: TransaksiBengkelCreate,
    db: DBSession,
    current_user: CurrentUser,
):
    """Create a new workshop sales transaction."""
    service = TransaksiBengkelService(db)
    return service.create(data, current_user.id)


@router.get("", response_model=TransaksiBengkelList)
def list_transaksi(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    customer_id: Optional[int] = None,
    mobil_id: Optional[int] = None,
    muatan_id: Optional[int] = None,
    status_bayar: Optional[PaymentStatus] = None,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
    sort_by: str = "id",
    sort_order: str = "desc",
):

    """Get list of workshop transactions with pagination and filters."""
    service = TransaksiBengkelService(db)
    return service.get_list(
        skip=skip,
        limit=limit,
        search=search,
        customer_id=customer_id,
        mobil_id=mobil_id,
        muatan_id=muatan_id,
        status_bayar=status_bayar,
        tanggal_dari=tanggal_dari,
        tanggal_sampai=tanggal_sampai,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get("/summary")
def get_transaksi_summary(
    db: DBSession,
    current_user: UnitManagerUser,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
    search: Optional[str] = None,
    customer_id: Optional[int] = None,
    mobil_id: Optional[int] = None,
    muatan_id: Optional[int] = None,
):
    """Get workshop sales summary statistics with active filters."""
    service = TransaksiBengkelService(db)
    return service.get_summary(
        tanggal_dari=tanggal_dari,
        tanggal_sampai=tanggal_sampai,
        search=search,
        customer_id=customer_id,
        mobil_id=mobil_id,
        muatan_id=muatan_id
    )



@router.get("/daily/{tanggal}")
def get_daily_summary(
    tanggal: date,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get daily sales summary."""
    service = TransaksiBengkelService(db)
    return service.get_daily_summary(tanggal)


@router.get("/{transaksi_id}", response_model=TransaksiBengkelResponse)
def get_transaksi(
    transaksi_id: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get transaction by ID."""
    service = TransaksiBengkelService(db)
    return service.get_by_id(transaksi_id)


@router.patch("/{transaksi_id}/payment", response_model=TransaksiBengkelResponse)
def update_payment(
    transaksi_id: int,
    data: PaymentUpdate,
    db: DBSession,
    current_user: ManagerUser,
):
    """Add payment to transaction."""
    service = TransaksiBengkelService(db)
    return service.update_payment(transaksi_id, data.jumlah_bayar, data.metode_bayar, current_user.id)


@router.put("/{transaksi_id}", response_model=TransaksiBengkelResponse)
def update_transaksi(
    transaksi_id: int,
    data: TransaksiBengkelCreate, # Reusing Create schema as it contains all needed fields for edit
    db: DBSession,
    current_user: UnitManagerUser,
):
    """Update an existing workshop transaction."""
    service = TransaksiBengkelService(db)
    return service.update(transaksi_id, data, current_user.id)


@router.patch("/{transaksi_id}/status", response_model=TransaksiBengkelResponse)
def update_status(
    transaksi_id: int,
    status: WorkshopStatus,
    db: DBSession,
    current_user: UnitManagerUser,
):
    """Update transaction working status."""
    service = TransaksiBengkelService(db)
    return service.update_status(transaksi_id, status)


@router.delete("/{transaksi_id}")
def void_transaksi(
    transaksi_id: int,
    db: DBSession,
    current_user: ManagerUser,
):
    """Void transaction and restore stock."""
    service = TransaksiBengkelService(db)
    service.void_transaction(transaksi_id)
    return {"message": "Transaksi berhasil dibatalkan"}
