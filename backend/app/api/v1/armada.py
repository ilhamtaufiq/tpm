from datetime import date
from typing import Optional, List
from fastapi import APIRouter, Query, status

from app.api.deps import DBSession, CurrentUser, UnitManagerUser
from app.schemas.jasa_angkut import (
    ArmadaCreate,
    ArmadaUpdate,
    ArmadaResponse,
    ArmadaList,
    ArmadaDetailResponse,
    ArmadaExpenseCreate,
)
from app.services.armada_service import ArmadaService

router = APIRouter(prefix="/armada", tags=["Armada (Fleet)"])

@router.post("", response_model=ArmadaResponse, status_code=status.HTTP_201_CREATED)
def create_armada(
    data: ArmadaCreate,
    db: DBSession,
    current_user: UnitManagerUser,
):
    """Create a new armada."""
    service = ArmadaService(db)
    return service.create(data)

@router.get("", response_model=ArmadaList)
def list_armada(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
):
    """Get list of armada with pagination and filters."""
    service = ArmadaService(db)
    return service.get_list(
        skip=skip,
        limit=limit,
        search=search,
        is_active=is_active,
    )

@router.get("/active", response_model=List[ArmadaResponse])
def get_active_armada(
    db: DBSession,
    current_user: CurrentUser,
    tanggal: Optional[date] = None,
):
    """Get all active armada for dropdown selection."""
    service = ArmadaService(db)
    return service.get_active_armada(on_date=tanggal)

@router.get("/{armada_id}", response_model=ArmadaResponse)
def get_armada(
    armada_id: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get armada by ID."""
    service = ArmadaService(db)
    return service.get_by_id(armada_id)

@router.get("/{armada_id}/detail", response_model=ArmadaDetailResponse)
def get_armada_detail(
    armada_id: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get exhaustive detail for an armada."""
    service = ArmadaService(db)
    return service.get_detail(armada_id)

@router.put("/{armada_id}", response_model=ArmadaResponse)
def update_armada(
    armada_id: int,
    data: ArmadaUpdate,
    db: DBSession,
    current_user: UnitManagerUser,
):
    """Update armada information."""
    service = ArmadaService(db)
    return service.update(armada_id, data)

@router.delete("/{armada_id}")
def delete_armada(
    armada_id: int,
    db: DBSession,
    current_user: UnitManagerUser,
):
    """Soft delete armada."""
    service = ArmadaService(db)
    service.delete(armada_id)
    return {"message": "Armada berhasil dihapus"}

@router.post("/{armada_id}/expense", status_code=status.HTTP_201_CREATED)
def add_armada_expense(
    armada_id: int,
    data: ArmadaExpenseCreate,
    db: DBSession,
    current_user: CurrentUser,
):
    """Add a general operational expense to an armada."""
    service = ArmadaService(db)
    return service.add_expense(armada_id, data, user_id=current_user.id)
