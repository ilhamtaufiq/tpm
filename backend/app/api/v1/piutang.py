from typing import Optional
from datetime import date

from fastapi import APIRouter, Query, status

from app.api.deps import DBSession, CurrentUser, ManagerUser
from app.schemas.keuangan import (
    PiutangCreate,
    PiutangUpdate,
    PiutangResponse,
    PembayaranPiutangCreate,
    PembayaranPiutangResponse,
)
from app.services.piutang_service import PiutangService
from app.utils.constants import PiutangStatus, PiutangSource


router = APIRouter(prefix="/piutang", tags=["Piutang (Receivables)"])


@router.post("", response_model=PiutangResponse, status_code=status.HTTP_201_CREATED)
def create_piutang(
    data: PiutangCreate,
    db: DBSession,
    current_user: ManagerUser,
):
    """Create a new receivable record."""
    service = PiutangService(db)
    return service.create(data, current_user.id)


@router.get("")
def list_piutang(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    customer_id: Optional[int] = None,
    sumber: Optional[PiutangSource] = None,
    status: Optional[PiutangStatus] = None,
    overdue_only: bool = False,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
    sort_by: str = "tanggal",
    sort_order: str = "desc",
):
    """Get list of receivables with pagination and filters."""
    service = PiutangService(db)
    return service.get_list(
        skip=skip,
        limit=limit,
        search=search,
        customer_id=customer_id,
        sumber=sumber,
        status=status,
        overdue_only=overdue_only,
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
    """Get receivables summary."""
    service = PiutangService(db)
    return service.get_summary(tanggal_dari, tanggal_sampai)


@router.get("/overdue")
def get_overdue(
    db: DBSession,
    current_user: CurrentUser,
    limit: int = Query(20, ge=1, le=100),
):
    """Get overdue receivables."""
    service = PiutangService(db)
    return service.get_overdue(limit)


@router.get("/customer/{customer_id}")
def get_by_customer(
    customer_id: int,
    db: DBSession,
    current_user: CurrentUser,
    unpaid_only: bool = True,
):
    """Get receivables for specific customer."""
    service = PiutangService(db)
    return service.get_by_customer(customer_id, unpaid_only)


@router.get("/customer/{customer_id}/total")
def get_customer_total(
    customer_id: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get total receivables for customer."""
    service = PiutangService(db)
    return service.get_customer_total(customer_id)


@router.get("/{piutang_id}", response_model=PiutangResponse)
def get_piutang(
    piutang_id: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get receivable by ID."""
    service = PiutangService(db)
    return service.get_by_id(piutang_id)


@router.get("/{piutang_id}/payments")
def get_payment_history(
    piutang_id: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get payment history for a receivable."""
    service = PiutangService(db)
    return service.get_payment_history(piutang_id)


@router.put("/{piutang_id}", response_model=PiutangResponse)
def update_piutang(
    piutang_id: int,
    data: PiutangUpdate,
    db: DBSession,
    current_user: ManagerUser,
):
    """Update receivable record."""
    service = PiutangService(db)
    return service.update(piutang_id, data)


@router.post("/payment", response_model=PembayaranPiutangResponse, status_code=status.HTTP_201_CREATED)
def process_payment(
    data: PembayaranPiutangCreate,
    db: DBSession,
    current_user: ManagerUser,
):
    """Process payment for receivable."""
    service = PiutangService(db)
    return service.process_payment(data, current_user.id)


@router.delete("/{piutang_id}")
def delete_piutang(
    piutang_id: int,
    db: DBSession,
    current_user: ManagerUser,
):
    """Delete receivable (only if no payments)."""
    service = PiutangService(db)
    service.delete(piutang_id)
    return {"message": "Piutang berhasil dihapus"}
