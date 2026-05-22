from typing import Optional
from datetime import date

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import DBSession, CurrentUser, ManagerUser, UnitManagerUser, get_unit_scope_for_role
from app.schemas.keuangan import (
    PiutangCreate,
    PiutangUpdate,
    PiutangResponse,
    PembayaranPiutangCreate,
    PembayaranPiutangSplit,
    PembayaranPiutangResponse,
)
from app.services.piutang_service import PiutangService
from app.utils.constants import PiutangStatus, PiutangSource, KasBankSource


router = APIRouter(prefix="/piutang", tags=["Piutang (Receivables)"])


@router.post("", response_model=PiutangResponse, status_code=status.HTTP_201_CREATED)
def create_piutang(
    data: PiutangCreate,
    db: DBSession,
    current_user: UnitManagerUser,
):
    """Create a new receivable record."""
    unit_scope = get_unit_scope_for_role(current_user.role)
    if unit_scope:
        data = data.model_copy(update={"unit": unit_scope})

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
    unit: Optional[KasBankSource] = None,
    sort_by: str = "tanggal",
    sort_order: str = "desc",
):
    """Get list of receivables with pagination and filters."""
    service = PiutangService(db)
    role_unit_scope = get_unit_scope_for_role(current_user.role)
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
        unit=role_unit_scope or unit,
    )


@router.get("/summary")
def get_summary(
    db: DBSession,
    current_user: UnitManagerUser,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
    unit: Optional[KasBankSource] = None,
):
    """Get receivables summary."""
    service = PiutangService(db)
    role_unit_scope = get_unit_scope_for_role(current_user.role)
    return service.get_summary(tanggal_dari, tanggal_sampai, unit=role_unit_scope or unit)


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
    current_user: UnitManagerUser,
):
    """Process payment for receivable."""
    service = PiutangService(db)
    unit_scope = get_unit_scope_for_role(current_user.role)
    if unit_scope and service.get_by_id(data.piutang_id).unit != unit_scope:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Akses piutang unit ditolak")
    return service.process_payment(data, current_user.id)


@router.post("/payment/split", status_code=status.HTTP_201_CREATED)
def process_payment_split(
    data: PembayaranPiutangSplit,
    db: DBSession,
    current_user: UnitManagerUser,
):
    """Process multiple payments for a receivable."""
    service = PiutangService(db)
    unit_scope = get_unit_scope_for_role(current_user.role)
    if unit_scope and service.get_by_id(data.piutang_id).unit != unit_scope:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Akses piutang unit ditolak")
    return service.process_payment_split(data, current_user.id)


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
