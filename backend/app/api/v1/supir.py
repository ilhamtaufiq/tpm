from typing import Optional

from fastapi import APIRouter, Query, status

from app.api.deps import DBSession, CurrentUser, UnitManagerUser
from app.schemas.jasa_angkut import (
    SupirCreate,
    SupirUpdate,
    SupirResponse,
)
from app.services.supir_service import SupirService


router = APIRouter(prefix="/supir", tags=["Supir (Driver)"])


@router.post("", response_model=SupirResponse, status_code=status.HTTP_201_CREATED)
def create_supir(
    data: SupirCreate,
    db: DBSession,
    current_user: UnitManagerUser,
):
    """Create a new driver."""
    service = SupirService(db)
    return service.create(data)


@router.get("")
def list_supir(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    sort_by: str = "nama",
    sort_order: str = "asc",
):
    """Get list of drivers with pagination and filters."""
    service = SupirService(db)
    return service.get_list(
        skip=skip,
        limit=limit,
        search=search,
        is_active=is_active,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get("/search")
def search_supir(
    db: DBSession,
    current_user: CurrentUser,
    q: str = Query(..., min_length=1),
    active_only: bool = True,
    limit: int = Query(10, ge=1, le=50),
):
    """Search drivers for autocomplete."""
    service = SupirService(db)
    return service.search(q, active_only, limit)


@router.get("/active")
def get_active_drivers(
    db: DBSession,
    current_user: CurrentUser,
):
    """Get all active drivers for dropdown selection."""
    service = SupirService(db)
    return service.get_active_drivers()


@router.get("/{supir_id}", response_model=SupirResponse)
def get_supir(
    supir_id: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get driver by ID."""
    service = SupirService(db)
    return service.get_by_id(supir_id)


@router.get("/{supir_id}/summary")
def get_supir_summary(
    supir_id: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get driver summary with statistics."""
    service = SupirService(db)
    return service.get_summary(supir_id)


@router.put("/{supir_id}", response_model=SupirResponse)
def update_supir(
    supir_id: int,
    data: SupirUpdate,
    db: DBSession,
    current_user: UnitManagerUser,
):
    """Update driver information."""
    service = SupirService(db)
    return service.update(supir_id, data)


@router.patch("/{supir_id}/active", response_model=SupirResponse)
def set_active_status(
    supir_id: int,
    is_active: bool,
    db: DBSession,
    current_user: UnitManagerUser,
):
    """Set driver active status."""
    service = SupirService(db)
    return service.set_active(supir_id, is_active)


@router.delete("/{supir_id}")
def delete_supir(
    supir_id: int,
    db: DBSession,
    current_user: UnitManagerUser,
):
    """Soft delete driver."""
    service = SupirService(db)
    service.delete(supir_id)
    return {"message": "Supir berhasil dihapus"}
