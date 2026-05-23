from typing import Optional

from fastapi import APIRouter, Query, status

from app.api.deps import DBSession, CurrentUser, UnitManagerUser
from app.schemas.karyawan import (
    KaryawanCreate,
    KaryawanUpdate,
    KaryawanResponse,
)
from app.services.karyawan_service import KaryawanService
from app.utils.constants import EmployeeStatus


router = APIRouter(prefix="/karyawan", tags=["Karyawan (Employee)"])


@router.post("", response_model=KaryawanResponse, status_code=status.HTTP_201_CREATED)
def create_karyawan(
    data: KaryawanCreate,
    db: DBSession,
    current_user: UnitManagerUser,
):
    """Create a new employee."""
    service = KaryawanService(db)
    return service.create(data)


@router.get("")
def list_karyawan(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[EmployeeStatus] = None,
    jabatan: Optional[str] = None,
    sort_by: str = "nama",
    sort_order: str = "asc",
):
    """Get list of employees with pagination and filters."""
    service = KaryawanService(db)
    return service.get_list(
        skip=skip,
        limit=limit,
        search=search,
        status=status,
        jabatan=jabatan,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get("/search")
def search_karyawan(
    db: DBSession,
    current_user: CurrentUser,
    q: str = Query(..., min_length=1),
    active_only: bool = True,
    limit: int = Query(10, ge=1, le=50),
):
    """Search employees for autocomplete."""
    service = KaryawanService(db)
    return service.search(q, active_only, limit)


@router.get("/active")
def get_active_employees(
    db: DBSession,
    current_user: CurrentUser,
):
    """Get all active employees for dropdown selection."""
    service = KaryawanService(db)
    return service.get_active_employees()


@router.get("/positions")
def get_positions(
    db: DBSession,
    current_user: CurrentUser,
):
    """Get distinct employee positions for filter dropdown."""
    service = KaryawanService(db)
    return service.get_positions()


@router.get("/stats")
def get_employee_stats(
    db: DBSession,
    current_user: UnitManagerUser,
):
    """Get overall employee statistics."""
    service = KaryawanService(db)
    return service.get_employee_stats()


@router.get("/{karyawan_id}", response_model=KaryawanResponse)
def get_karyawan(
    karyawan_id: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get employee by ID."""
    service = KaryawanService(db)
    return service.get_by_id(karyawan_id)


@router.get("/{karyawan_id}/summary")
def get_karyawan_summary(
    karyawan_id: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get employee summary with statistics."""
    service = KaryawanService(db)
    return service.get_summary(karyawan_id)


@router.put("/{karyawan_id}", response_model=KaryawanResponse)
def update_karyawan(
    karyawan_id: int,
    data: KaryawanUpdate,
    db: DBSession,
    current_user: UnitManagerUser,
):
    """Update employee information."""
    service = KaryawanService(db)
    return service.update(karyawan_id, data)


@router.patch("/{karyawan_id}/status", response_model=KaryawanResponse)
def set_status(
    karyawan_id: int,
    status: EmployeeStatus,
    db: DBSession,
    current_user: UnitManagerUser,
):
    """Set employee status."""
    service = KaryawanService(db)
    return service.set_status(karyawan_id, status)


@router.delete("/{karyawan_id}")
def delete_karyawan(
    karyawan_id: int,
    db: DBSession,
    current_user: UnitManagerUser,
):
    """Soft delete employee."""
    service = KaryawanService(db)
    service.delete(karyawan_id)
    return {"message": "Karyawan berhasil dihapus"}
