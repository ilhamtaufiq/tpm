from typing import Optional, List
from datetime import date

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import DBSession, CurrentUser, ManagerUser, UnitManagerUser, get_unit_scope_for_role
from app.schemas.keuangan import (
    HutangCreate,
    HutangResponse,
    HutangList,
    HutangSummary,
    PembayaranHutangCreate,
    PembayaranHutangResponse,
    PembayaranHutangSplit,
)
from app.services.hutang_service import HutangService
from app.utils.constants import HutangStatus, HutangSource, KasBankSource


router = APIRouter(prefix="/hutang", tags=["Keuangan - Hutang Usaha"])


@router.get("", response_model=HutangList)
def list_hutang(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    supplier_id: Optional[int] = None,
    sumber: Optional[HutangSource] = None,
    status: Optional[HutangStatus] = None,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
    unit: Optional[KasBankSource] = None,
    sort_by: str = "tanggal",
    sort_order: str = "desc",
):
    """Get list of payables with pagination and filters."""
    service = HutangService(db)
    role_unit_scope = get_unit_scope_for_role(current_user.role)
    return service.get_list(
        skip=skip,
        limit=limit,
        search=search,
        supplier_id=supplier_id,
        sumber=sumber,
        status=status,
        tanggal_dari=tanggal_dari,
        tanggal_sampai=tanggal_sampai,
        sort_by=sort_by,
        sort_order=sort_order,
        unit=role_unit_scope or unit,
    )


@router.get("/summary", response_model=HutangSummary)
def get_hutang_summary(
    db: DBSession,
    current_user: UnitManagerUser,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
    unit: Optional[KasBankSource] = None,
):
    """Get payables summary statistics."""
    service = HutangService(db)
    role_unit_scope = get_unit_scope_for_role(current_user.role)
    return service.get_summary(tanggal_dari, tanggal_sampai, unit=role_unit_scope or unit)


@router.get("/{hutang_id}", response_model=HutangResponse)
def get_hutang(
    hutang_id: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get payable by ID."""
    service = HutangService(db)
    return service.get_by_id(hutang_id)


@router.post("/pembayaran", response_model=PembayaranHutangResponse)
def create_pembayaran(
    data: PembayaranHutangCreate,
    db: DBSession,
    current_user: UnitManagerUser,
):
    """Process payment for a payable."""
    service = HutangService(db)
    unit_scope = get_unit_scope_for_role(current_user.role)
    if unit_scope and service.get_by_id(data.hutang_id).unit != unit_scope:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Akses hutang unit ditolak")
    return service.process_payment(data, current_user.id)


@router.post("/pembayaran-split", response_model=List[PembayaranHutangResponse])
def create_pembayaran_split(
    data: PembayaranHutangSplit,
    db: DBSession,
    current_user: UnitManagerUser,
):
    """Process multiple payments for a payable at once."""
    service = HutangService(db)
    unit_scope = get_unit_scope_for_role(current_user.role)
    if unit_scope and service.get_by_id(data.hutang_id).unit != unit_scope:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Akses hutang unit ditolak")
    return service.process_payment_split(data, current_user.id)


@router.post("", response_model=HutangResponse, status_code=status.HTTP_201_CREATED)
def create_hutang(
    data: HutangCreate,
    db: DBSession,
    current_user: ManagerUser,
):
    """Create a new payable record."""
    service = HutangService(db)
    return service.create(data, current_user.id)
