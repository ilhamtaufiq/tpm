from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Query, status, Body, HTTPException
from pydantic import BaseModel

from app.api.deps import DBSession, CurrentUser, ManagerUser
from app.schemas.karyawan import (
    SlipGajiCreate,
    SlipGajiUpdate,
    SlipGajiResponse,
    SlipGajiList,
)
from app.services.slip_gaji_service import SlipGajiService
from app.utils.constants import PaymentStatus


router = APIRouter(prefix="/slip-gaji", tags=["Slip Gaji (Weekly Payroll)"])


class SlipGajiBulkItem(BaseModel):
    """Item for bulk slip gaji creation with attendance override."""
    karyawan_id: int
    jumlah_hadir: int


class SlipGajiBulkCreate(BaseModel):
    """Request body for bulk slip gaji creation."""
    items: List[SlipGajiBulkItem]
    tanggal_mulai: Optional[str] = None  # Custom start date override (YYYY-MM-DD)


@router.post("", response_model=SlipGajiResponse, status_code=status.HTTP_201_CREATED)
def create_slip_gaji(
    data: SlipGajiCreate,
    db: DBSession,
    current_user: ManagerUser,
):
    """Create a new weekly payroll slip."""
    service = SlipGajiService(db)
    return service.create(data, current_user.id)


@router.get("/preview/{tahun}/{minggu}")
def get_preview(
    tahun: int,
    minggu: int,
    db: DBSession,
    current_user: ManagerUser,
):
    """Get preview of employees for slip gaji generation with calculated attendance."""
    service = SlipGajiService(db)
    return service.get_preview(minggu, tahun)


@router.get("/preview-range")
def get_preview_range(
    tanggal_dari: str,
    tanggal_sampai: str,
    db: DBSession,
    current_user: ManagerUser,
):
    """Get preview of employees for slip gaji generation within a custom date range."""
    service = SlipGajiService(db)
    try:
        start_date = datetime.strptime(tanggal_dari, "%Y-%m-%d").date()
        end_date = datetime.strptime(tanggal_sampai, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    return service.get_preview_by_range(start_date, end_date)


@router.post("/bulk/{tahun}/{minggu}")
def create_bulk_slip_gaji(
    tahun: int,
    minggu: int,
    db: DBSession,
    current_user: ManagerUser,
    data: Optional[SlipGajiBulkCreate] = None,
):
    """Create weekly payroll slips with optional attendance override."""
    service = SlipGajiService(db)
    items = [item.model_dump() for item in data.items] if data else None
    tanggal_mulai = data.tanggal_mulai if data else None
    return service.create_bulk(minggu, tahun, items, current_user.id, tanggal_mulai)


@router.post("/bulk-range")
def create_bulk_range(
    tanggal_dari: str,
    tanggal_sampai: str,
    db: DBSession,
    current_user: ManagerUser,
    data: Optional[SlipGajiBulkCreate] = None,
):
    """Create payroll slips for a custom date range."""
    service = SlipGajiService(db)
    try:
        start_date = datetime.strptime(tanggal_dari, "%Y-%m-%d").date()
        end_date = datetime.strptime(tanggal_sampai, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Use start date to determine target week/year for the record
    from app.services.slip_gaji_service import get_current_week
    minggu, tahun = get_current_week(start_date)
    
    items = [item.model_dump() for item in data.items] if data else None
    # We still need to pass tanggal_mulai/akhir to the service if we want to override the default week range
    return service.create_bulk_by_range(start_date, end_date, minggu, tahun, items, current_user.id)


@router.get("", response_model=SlipGajiList)
def list_slip_gaji(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    karyawan_id: Optional[int] = None,
    periode_minggu: Optional[int] = None,
    periode_tahun: Optional[int] = None,
    status: Optional[PaymentStatus] = None,
    sort_by: str = "periode",
    sort_order: str = "desc",
):
    """Get list of weekly payroll slips with pagination and filters."""
    service = SlipGajiService(db)
    return service.get_list(
        skip=skip,
        limit=limit,
        karyawan_id=karyawan_id,
        periode_minggu=periode_minggu,
        periode_tahun=periode_tahun,
        status=status,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get("/summary/{tahun}/{minggu}")
def get_weekly_summary(
    tahun: int,
    minggu: int,
    db: DBSession,
    current_user: ManagerUser,
):
    """Get summary of payroll for a week."""
    service = SlipGajiService(db)
    return service.get_weekly_summary(minggu, tahun)


@router.get("/{slip_id}", response_model=SlipGajiResponse)
def get_slip_gaji(
    slip_id: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get payroll slip by ID."""
    service = SlipGajiService(db)
    return service.get_by_id(slip_id)


@router.post("/{slip_id}/pay", response_model=SlipGajiResponse)
def process_payment(
    slip_id: int,
    data: SlipGajiUpdate,
    db: DBSession,
    current_user: ManagerUser,
):
    """Process salary payment."""
    service = SlipGajiService(db)
    return service.process_payment(slip_id, data, current_user.id)


@router.post("/{slip_id}/void", response_model=SlipGajiResponse)
def void_payment(
    slip_id: int,
    db: DBSession,
    current_user: ManagerUser,
):
    """Void/cancel salary payment."""
    service = SlipGajiService(db)
    return service.void_payment(slip_id, current_user.id)


@router.delete("/{slip_id}")
def delete_slip_gaji(
    slip_id: int,
    db: DBSession,
    current_user: ManagerUser,
):
    """Delete payroll slip (only if unpaid)."""
    service = SlipGajiService(db)
    service.delete(slip_id)
    return {"message": "Slip gaji berhasil dihapus"}
