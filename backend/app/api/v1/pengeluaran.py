from typing import Optional
from datetime import date

from fastapi import APIRouter, Query, status

from app.api.deps import DBSession, CurrentUser, ManagerUser
from app.schemas.bengkel import (
    PengeluaranBengkelCreate,
    PengeluaranBengkelUpdate,
    PengeluaranBengkelResponse,
    PengeluaranListResponse,
)
from app.services.pengeluaran_service import PengeluaranService
from app.utils.constants import ExpenseCategory, PaymentMethod


router = APIRouter(prefix="/pengeluaran", tags=["Pengeluaran Bengkel"])


@router.post("", response_model=PengeluaranBengkelResponse, status_code=status.HTTP_201_CREATED)
def create_pengeluaran(
    data: PengeluaranBengkelCreate,
    db: DBSession,
    current_user: CurrentUser,
):
    """Create a new expense record."""
    service = PengeluaranService(db)
    return service.create(data, current_user.id)


@router.get("", response_model=PengeluaranListResponse)
def list_pengeluaran(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    kategori: Optional[ExpenseCategory] = None,
    metode_bayar: Optional[PaymentMethod] = None,
    bisnis_kategori: Optional[str] = None,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
    sort_by: str = "tanggal",
    sort_order: str = "desc",
):
    """Get list of expenses with pagination and filters."""
    service = PengeluaranService(db)
    return service.get_list(
        skip=skip,
        limit=limit,
        search=search,
        kategori=kategori,
        metode_bayar=metode_bayar,
        bisnis_kategori=bisnis_kategori,
        tanggal_dari=tanggal_dari,
        tanggal_sampai=tanggal_sampai,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get("/summary")
def get_pengeluaran_summary(
    db: DBSession,
    current_user: CurrentUser,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
):
    """Get expense summary statistics."""
    service = PengeluaranService(db)
    return service.get_summary(tanggal_dari, tanggal_sampai)


@router.get("/daily/{tanggal}")
def get_daily_summary(
    tanggal: date,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get daily expense summary."""
    service = PengeluaranService(db)
    return service.get_daily_summary(tanggal)


@router.get("/monthly/{year}/{month}")
def get_monthly_summary(
    year: int,
    month: int,
    db: DBSession,
    current_user: ManagerUser,
):
    """Get monthly expense summary."""
    service = PengeluaranService(db)
    return service.get_monthly_summary(year, month)


@router.get("/{pengeluaran_id}", response_model=PengeluaranBengkelResponse)
def get_pengeluaran(
    pengeluaran_id: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get expense by ID."""
    service = PengeluaranService(db)
    return service.get_by_id(pengeluaran_id)


@router.put("/{pengeluaran_id}", response_model=PengeluaranBengkelResponse)
def update_pengeluaran(
    pengeluaran_id: int,
    data: PengeluaranBengkelUpdate,
    db: DBSession,
    current_user: ManagerUser,
):
    """Update expense record."""
    service = PengeluaranService(db)
    return service.update(pengeluaran_id, data)


@router.delete("/{pengeluaran_id}")
def delete_pengeluaran(
    pengeluaran_id: int,
    db: DBSession,
    current_user: ManagerUser,
):
    """Delete expense record."""
    service = PengeluaranService(db)
    service.delete(pengeluaran_id)
    return {"message": "Pengeluaran berhasil dihapus"}
