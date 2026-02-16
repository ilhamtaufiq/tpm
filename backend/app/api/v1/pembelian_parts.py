from typing import Optional
from datetime import date

from fastapi import APIRouter, Query, status

from app.api.deps import DBSession, CurrentUser, ManagerUser
from app.schemas.bengkel import (
    PembelianSparePartCreate,
    PembelianSparePartResponse,
    PembelianSparePartList,
)
from app.services.pembelian_part_service import PembelianPartService
from app.utils.constants import PaymentStatus, PaymentMethod


router = APIRouter(prefix="/pembelian-parts", tags=["Pembelian Spare Parts"])


@router.post("", response_model=PembelianSparePartResponse, status_code=status.HTTP_201_CREATED)
def create_pembelian(
    data: PembelianSparePartCreate,
    db: DBSession,
    current_user: CurrentUser,
):
    """Create a new spare part purchase transaction."""
    service = PembelianPartService(db)
    return service.create(data, current_user.id)


@router.get("", response_model=PembelianSparePartList)
def list_pembelian(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    supplier_id: Optional[int] = None,
    status_bayar: Optional[PaymentStatus] = None,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
    sort_by: str = "tanggal",
    sort_order: str = "desc",
):
    """Get list of purchase transactions with pagination and filters."""
    service = PembelianPartService(db)
    return service.get_list(
        skip=skip,
        limit=limit,
        search=search,
        supplier_id=supplier_id,
        status_bayar=status_bayar,
        tanggal_dari=tanggal_dari,
        tanggal_sampai=tanggal_sampai,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get("/summary")
def get_pembelian_summary(
    db: DBSession,
    current_user: ManagerUser,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
):
    """Get purchase summary statistics."""
    service = PembelianPartService(db)
    return service.get_summary(tanggal_dari, tanggal_sampai)


@router.get("/{pembelian_id}", response_model=PembelianSparePartResponse)
def get_pembelian(
    pembelian_id: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get purchase by ID."""
    service = PembelianPartService(db)
    return service.get_by_id(pembelian_id)


@router.patch("/{pembelian_id}/payment", response_model=PembelianSparePartResponse)
def update_payment(
    pembelian_id: int,
    metode_bayar: PaymentMethod,
    db: DBSession,
    current_user: ManagerUser,
    tanggal_bayar: Optional[date] = None,
):
    """Mark purchase as paid."""
    service = PembelianPartService(db)
    return service.update_payment(pembelian_id, metode_bayar, tanggal_bayar)


@router.delete("/{pembelian_id}")
def delete_pembelian(
    pembelian_id: int,
    db: DBSession,
    current_user: ManagerUser,
):
    """Delete purchase and revert stock (only unpaid)."""
    service = PembelianPartService(db)
    service.delete(pembelian_id)
    return {"message": "Transaksi pembelian berhasil dihapus"}
