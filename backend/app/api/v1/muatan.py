from typing import Optional
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Query, status

from app.api.deps import DBSession, CurrentUser, ManagerUser
from app.schemas.jasa_angkut import (
    MuatanCreate,
    MuatanUpdate,
    MuatanResponse,
    MuatanPaymentSplit,
)
from app.services.muatan_service import MuatanService
from app.utils.constants import PaymentStatus, PaymentMethod


router = APIRouter(prefix="/muatan", tags=["Muatan Jasa Angkut"])


@router.post("", response_model=MuatanResponse, status_code=status.HTTP_201_CREATED)
def create_muatan(
    data: MuatanCreate,
    db: DBSession,
    current_user: CurrentUser,
):
    """Create a new transport load record."""
    service = MuatanService(db)
    return service.create(data, current_user.id)


@router.get("")
def list_muatan(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    supir_id: Optional[int] = None,
    status_bayar: Optional[PaymentStatus] = None,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
    sort_by: str = "tanggal",
    sort_order: str = "desc",
):
    """Get list of transport loads with pagination and filters."""
    service = MuatanService(db)
    return service.get_list(
        skip=skip,
        limit=limit,
        search=search,
        supir_id=supir_id,
        status_bayar=status_bayar,
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
    """Get transport load summary statistics."""
    service = MuatanService(db)
    return service.get_summary(tanggal_dari, tanggal_sampai)


@router.get("/supir/{supir_id}/summary")
def get_driver_summary(
    supir_id: int,
    db: DBSession,
    current_user: CurrentUser,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
):
    """Get summary for specific driver."""
    service = MuatanService(db)
    return service.get_driver_summary(supir_id, tanggal_dari, tanggal_sampai)


@router.get("/supir/{supir_id}/recent")
def get_driver_recent(
    supir_id: int,
    db: DBSession,
    current_user: CurrentUser,
    limit: int = Query(10, ge=1, le=50),
):
    """Get recent transport loads for a driver."""
    service = MuatanService(db)
    return service.get_by_supir(supir_id, limit)


@router.get("/{muatan_id}", response_model=MuatanResponse)
def get_muatan(
    muatan_id: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get transport load by ID."""
    service = MuatanService(db)
    return service.get_by_id(muatan_id)


@router.put("/{muatan_id}", response_model=MuatanResponse)
def update_muatan(
    muatan_id: int,
    data: MuatanUpdate,
    db: DBSession,
    current_user: ManagerUser,
):
    """Update transport load."""
    service = MuatanService(db)
    return service.update(muatan_id, data)


@router.patch("/{muatan_id}/paid", response_model=MuatanResponse)
def mark_paid(
    muatan_id: int,
    db: DBSession,
    current_user: ManagerUser,
    metode_bayar: PaymentMethod = PaymentMethod.TUNAI,
    tanggal_bayar: Optional[date] = None,
):
    """Mark transport load as paid."""
    service = MuatanService(db)
    return service.mark_paid(muatan_id, metode_bayar, tanggal_bayar, current_user.id)


@router.post("/{muatan_id}/paid-split", response_model=MuatanResponse)
def mark_paid_split(
    muatan_id: int,
    data: MuatanPaymentSplit,
    db: DBSession,
    current_user: ManagerUser,
):
    """Mark transport load as paid with multiple payment methods."""
    service = MuatanService(db)
    # Ensure ID matches
    data.muatan_id = muatan_id
    return service.mark_paid_split(data, current_user.id)


@router.delete("/{muatan_id}")
def delete_muatan(
    muatan_id: int,
    db: DBSession,
    current_user: ManagerUser,
):
    """Delete transport load."""
    service = MuatanService(db)
    service.delete(muatan_id)
    return {"message": "Muatan berhasil dihapus"}


# Additional costs endpoints
@router.post("/{muatan_id}/biaya")
def add_biaya(
    muatan_id: int,
    kategori: str,
    deskripsi: str,
    jumlah: Decimal,
    db: DBSession,
    current_user: ManagerUser,
    catatan: Optional[str] = None,
):
    """Add additional cost to transport load."""
    service = MuatanService(db)
    return service.add_biaya(muatan_id, kategori, deskripsi, jumlah, catatan)


@router.delete("/{muatan_id}/biaya/{biaya_id}")
def delete_biaya(
    muatan_id: int,
    biaya_id: int,
    db: DBSession,
    current_user: ManagerUser,
):
    """Delete additional cost."""
    service = MuatanService(db)
    service.delete_biaya(biaya_id)
    return {"message": "Biaya berhasil dihapus"}
