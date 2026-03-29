from typing import Optional, List
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Query, status, File, UploadFile

from app.api.deps import DBSession, CurrentUser, ManagerUser
from app.schemas.mobil import (
    MobilCreate,
    MobilUpdate,
    MobilResponse,
    MobilList,
    MobilMediaResponse,
    MobilBiayaCreate,
    MobilPartServiceCreate,
    MobilDetailResponse,
)
from app.services.mobil_service import MobilService
from app.utils.constants import CarStatus, OwnershipType


router = APIRouter(prefix="/mobil", tags=["Inventaris Mobil"])


@router.post("", response_model=MobilResponse, status_code=status.HTTP_201_CREATED)
def create_mobil(
    data: MobilCreate,
    db: DBSession,
    current_user: ManagerUser,
):
    """Create a new car inventory record."""
    service = MobilService(db)
    return service.create(data, current_user.id)


@router.get("", response_model=MobilList)
def list_mobil(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[CarStatus] = None,
    status_bayar: Optional[str] = None,
    tipe_kepemilikan: Optional[OwnershipType] = None,
    merek: Optional[str] = None,
    tahun: Optional[int] = None,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
    sort_by: str = "tanggal_masuk",
    sort_order: str = "desc",
):
    """Get list of cars with pagination and filters."""
    service = MobilService(db)
    return service.get_list(
        skip=skip,
        limit=limit,
        search=search,
        status=status,
        payment_filter=status_bayar,
        tipe_kepemilikan=tipe_kepemilikan,
        merek=merek,
        tahun=tahun,
        tanggal_dari=tanggal_dari,
        tanggal_sampai=tanggal_sampai,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get("/available")
def get_available_cars(
    db: DBSession,
    current_user: CurrentUser,
    search: Optional[str] = None,
    limit: int = Query(20, ge=1, le=50),
):
    """Get available cars for sale selection."""
    service = MobilService(db)
    return service.get_available_for_sale(search, limit)


@router.get("/summary")
def get_inventory_summary(
    db: DBSession,
    current_user: ManagerUser,
    tanggal_dari: Optional[date] = None,
    tanggal_sampai: Optional[date] = None,
):
    """Get car inventory summary statistics."""
    service = MobilService(db)
    return service.get_inventory_summary(tanggal_dari, tanggal_sampai)


@router.get("/brands")
def get_brands(
    db: DBSession,
    current_user: CurrentUser,
):
    """Get distinct car brands for filter dropdown."""
    service = MobilService(db)
    return service.get_brands()


@router.get("/years")
def get_years(
    db: DBSession,
    current_user: CurrentUser,
):
    """Get distinct car years for filter dropdown."""
    service = MobilService(db)
    return service.get_years()


@router.get("/{mobil_id}", response_model=MobilDetailResponse)
def get_mobil(
    mobil_id: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get car by ID with all related data."""
    service = MobilService(db)
    return service.get_by_id(mobil_id)


@router.put("/{mobil_id}", response_model=MobilResponse)
def update_mobil(
    mobil_id: int,
    data: MobilUpdate,
    db: DBSession,
    current_user: ManagerUser,
):
    """Update car information."""
    service = MobilService(db)
    return service.update(mobil_id, data)


@router.patch("/{mobil_id}/status", response_model=MobilResponse)
def update_mobil_status(
    mobil_id: int,
    status: CarStatus,
    db: DBSession,
    current_user: ManagerUser,
):
    """Update car status."""
    service = MobilService(db)
    return service.update_status(mobil_id, status)


@router.delete("/{mobil_id}")
def delete_mobil(
    mobil_id: int,
    db: DBSession,
    current_user: ManagerUser,
):
    """Soft delete car from inventory."""
    service = MobilService(db)
    service.delete(mobil_id)
    return {"message": "Mobil berhasil dihapus"}


# Additional costs endpoints
@router.post("/{mobil_id}/biaya")
def add_biaya(
    mobil_id: int,
    data: MobilBiayaCreate,
    db: DBSession,
    current_user: ManagerUser,
):
    """Add additional cost to car."""
    service = MobilService(db)
    return service.add_biaya(
        mobil_id=mobil_id,
        tanggal=data.tanggal,
        kategori=data.kategori,
        deskripsi=data.deskripsi,
        jumlah=data.jumlah,
        metode_bayar=data.metode_bayar,
        payments=[p.model_dump() for p in data.payments] if data.payments else None,
        catatan=data.catatan,
        user_id=current_user.id,
    )


@router.delete("/{mobil_id}/biaya/{biaya_id}")
def delete_biaya(
    mobil_id: int,
    biaya_id: int,
    db: DBSession,
    current_user: ManagerUser,
):
    """Delete additional cost."""
    service = MobilService(db)
    service.delete_biaya(biaya_id)
    return {"message": "Biaya berhasil dihapus"}


# Part/service endpoints
@router.post("/{mobil_id}/part-service")
def add_part_service(
    mobil_id: int,
    data: MobilPartServiceCreate,
    db: DBSession,
    current_user: ManagerUser,
):
    """Add part/service cost to car."""
    service = MobilService(db)
    return service.add_part_service(
        mobil_id=mobil_id,
        tanggal=data.tanggal,
        tipe=data.tipe,
        deskripsi=data.deskripsi,
        qty=data.qty,
        harga_satuan=data.harga_satuan,
        catatan=data.catatan,
    )


@router.delete("/{mobil_id}/part-service/{part_service_id}")
def delete_part_service(
    mobil_id: int,
    part_service_id: int,
    db: DBSession,
    current_user: ManagerUser,
):
    """Delete part/service cost."""
    service = MobilService(db)
    service.delete_part_service(part_service_id)
    return {"message": "Part/Service berhasil dihapus"}


@router.post("/{mobil_id}/media", response_model=List[MobilMediaResponse])
def upload_media(
    mobil_id: int,
    db: DBSession,
    current_user: ManagerUser,
    files: List[UploadFile] = File(...),
):
    """Upload media for a car."""
    service = MobilService(db)
    return service.upload_media(mobil_id, files)


@router.delete("/{mobil_id}/media/{media_id}")
def delete_media(
    mobil_id: int,
    media_id: int,
    db: DBSession,
    current_user: ManagerUser,
):
    """Delete car media."""
    service = MobilService(db)
    service.delete_media(media_id)
    return {"message": "Media berhasil dihapus"}
