from typing import Optional, List
from datetime import date, time

from fastapi import APIRouter, Query, status as http_status

from app.api.deps import DBSession, CurrentUser, ManagerUser
from app.schemas.karyawan import (
    AbsensiCreate,
    AbsensiUpdate,
    AbsensiResponse,
)
from app.services.absensi_service import AbsensiService
from app.utils.constants import AttendanceStatus


router = APIRouter(prefix="/absensi", tags=["Absensi (Attendance)"])


@router.post("", response_model=AbsensiResponse, status_code=http_status.HTTP_201_CREATED)
def create_absensi(
    data: AbsensiCreate,
    db: DBSession,
    current_user: CurrentUser,
):
    """Create an attendance record."""
    service = AbsensiService(db)
    return service.create(data)


@router.post("/bulk")
def create_bulk_absensi(
    tanggal: date,
    items: List[AbsensiCreate],
    db: DBSession,
    current_user: ManagerUser,
):
    """Create multiple attendance records for a date."""
    service = AbsensiService(db)
    return service.create_bulk(tanggal, items)


@router.get("")
def list_absensi(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    karyawan_id: Optional[int] = None,
    status: Optional[AttendanceStatus] = None,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
    sort_by: str = "tanggal",
    sort_order: str = "desc",
):
    """Get list of attendance records with pagination and filters."""
    service = AbsensiService(db)
    return service.get_list(
        skip=skip,
        limit=limit,
        karyawan_id=karyawan_id,
        status=status,
        tanggal_dari=tanggal_dari,
        tanggal_sampai=tanggal_sampai,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get("/daily/{tanggal}")
def get_daily_attendance(
    tanggal: date,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get attendance for a specific date with all employees."""
    service = AbsensiService(db)
    return service.get_daily(tanggal)


@router.get("/monthly/{karyawan_id}/{tahun}/{bulan}")
def get_monthly_summary(
    karyawan_id: int,
    tahun: int,
    bulan: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get monthly attendance summary for an employee."""
    service = AbsensiService(db)
    return service.get_monthly_summary(karyawan_id, bulan, tahun)


@router.get("/monthly-all/{tahun}/{bulan}")
def get_all_monthly_summaries(
    tahun: int,
    bulan: int,
    db: DBSession,
    current_user: ManagerUser,
):
    """Get monthly attendance summary for all employees."""
    service = AbsensiService(db)
    return service.get_all_monthly_summaries(bulan, tahun)


@router.get("/{absensi_id}", response_model=AbsensiResponse)
def get_absensi(
    absensi_id: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get attendance by ID."""
    service = AbsensiService(db)
    return service.get_by_id(absensi_id)


@router.put("/{absensi_id}", response_model=AbsensiResponse)
def update_absensi(
    absensi_id: int,
    data: AbsensiUpdate,
    db: DBSession,
    current_user: ManagerUser,
):
    """Update attendance record."""
    service = AbsensiService(db)
    return service.update(absensi_id, data)


@router.delete("/{absensi_id}")
def delete_absensi(
    absensi_id: int,
    db: DBSession,
    current_user: ManagerUser,
):
    """Delete attendance record."""
    service = AbsensiService(db)
    service.delete(absensi_id)
    return {"message": "Absensi berhasil dihapus"}


# Clock in/out endpoints
@router.post("/clock-in", response_model=AbsensiResponse)
def clock_in(
    karyawan_id: int,
    db: DBSession,
    current_user: CurrentUser,
    tanggal: Optional[date] = None,
    jam: Optional[time] = None,
    status: AttendanceStatus = AttendanceStatus.HADIR,
):
    """Record employee clock in."""
    service = AbsensiService(db)
    return service.clock_in(karyawan_id, tanggal, jam, status)


@router.post("/clock-out", response_model=AbsensiResponse)
def clock_out(
    karyawan_id: int,
    db: DBSession,
    current_user: CurrentUser,
    tanggal: Optional[date] = None,
    jam: Optional[time] = None,
):
    """Record employee clock out."""
    service = AbsensiService(db)
    return service.clock_out(karyawan_id, tanggal, jam)
