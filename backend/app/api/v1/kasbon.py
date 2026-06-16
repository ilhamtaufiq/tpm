from typing import Optional
from datetime import date

from fastapi import APIRouter, Query, status

from app.api.deps import DBSession, CurrentUser, ManagerUser, UnitManagerUser, get_unit_scope_for_role
from app.schemas.karyawan import (
    KasbonCreate,
    KasbonResponse,
    KasbonPaymentSplit,
    KasbonList,
)
from app.services.kasbon_service import KasbonService
from app.utils.constants import PaymentStatus


router = APIRouter(prefix="/kasbon", tags=["Kasbon Karyawan"])


@router.post("", response_model=KasbonResponse, status_code=status.HTTP_201_CREATED)
def create_kasbon(
    data: KasbonCreate,
    db: DBSession,
    current_user: UnitManagerUser,
):
    """Create a new employee cash advance."""
    unit_scope = get_unit_scope_for_role(current_user.role)
    if unit_scope:
        data = data.model_copy(update={"unit": unit_scope})

    service = KasbonService(db)
    return service.create(data, current_user.id)


@router.get("", response_model=KasbonList)
def list_kasbon(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    karyawan_id: Optional[int] = None,
    status: Optional[PaymentStatus] = None,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
    sort_by: str = "tanggal",
    sort_order: str = "desc",
):
    """Get list of kasbon with pagination and filters."""
    service = KasbonService(db)
    return service.get_list(
        skip=skip,
        limit=limit,
        karyawan_id=karyawan_id,
        status=status,
        tanggal_dari=tanggal_dari,
        tanggal_sampai=tanggal_sampai,
        sort_by=sort_by,
        sort_order=sort_order,
        unit=get_unit_scope_for_role(current_user.role),
    )


@router.get("/summary")
def get_summary(
    db: DBSession,
    current_user: UnitManagerUser,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
):
    """Get kasbon summary statistics."""
    service = KasbonService(db)
    return service.get_summary(
        tanggal_dari,
        tanggal_sampai,
        unit=get_unit_scope_for_role(current_user.role),
    )


@router.get("/top-debtors")
def get_top_debtors(
    db: DBSession,
    current_user: ManagerUser,
    limit: int = Query(10, ge=1, le=50),
):
    """Get employees with highest unpaid kasbon."""
    service = KasbonService(db)
    return service.get_top_debtors(limit)


@router.get("/karyawan/{karyawan_id}")
def get_employee_kasbon(
    karyawan_id: int,
    db: DBSession,
    current_user: CurrentUser,
    unpaid_only: bool = True,
):
    """Get kasbon for specific employee."""
    service = KasbonService(db)
    return service.get_employee_kasbon(karyawan_id, unpaid_only)


@router.get("/karyawan/{karyawan_id}/total")
def get_employee_kasbon_total(
    karyawan_id: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get total unpaid kasbon for employee."""
    service = KasbonService(db)
    total = service.get_employee_kasbon_total(karyawan_id)
    return {"karyawan_id": karyawan_id, "total_kasbon": float(total)}


@router.get("/{kasbon_id}", response_model=KasbonResponse)
def get_kasbon(
    kasbon_id: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get kasbon by ID."""
    service = KasbonService(db)
    return service.get_by_id(kasbon_id)


@router.patch("/{kasbon_id}/paid", response_model=KasbonResponse)
def mark_paid(
    kasbon_id: int,
    db: DBSession,
    current_user: ManagerUser,
    tanggal_lunas: Optional[date] = None,
):
    """Mark kasbon as paid."""
    service = KasbonService(db)
    return service.mark_paid(kasbon_id, tanggal_lunas)


@router.post("/{kasbon_id}/pay-split", response_model=KasbonResponse)
def process_payment_split(
    kasbon_id: int,
    data: KasbonPaymentSplit,
    db: DBSession,
    current_user: ManagerUser,
):
    """Process split payment for kasbon."""
    service = KasbonService(db)
    return service.process_payment_split(kasbon_id, data.payments, data.catatan, current_user.id)


@router.delete("/{kasbon_id}")
def delete_kasbon(
    kasbon_id: int,
    db: DBSession,
    current_user: ManagerUser,
):
    """Delete kasbon (only if unpaid)."""
    service = KasbonService(db)
    service.delete(kasbon_id)
    return {"message": "Kasbon berhasil dihapus"}
