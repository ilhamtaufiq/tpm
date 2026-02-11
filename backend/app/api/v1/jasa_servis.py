from typing import Any, Optional
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.bengkel import JasaServisCreate, JasaServisUpdate, JasaServisResponse, JasaServisList
from app.services.jasa_servis_service import JasaServisService
from app.api.deps import get_current_user

router = APIRouter()


@router.post("", response_model=JasaServisResponse, status_code=status.HTTP_201_CREATED)
def create_jasa_servis(
    *,
    db: Session = Depends(get_db),
    data: JasaServisCreate,
    current_user: Any = Depends(get_current_user),
) -> Any:
    """Create a new workshop service."""
    service = JasaServisService(db)
    return service.create(data)


@router.get("", response_model=JasaServisList)
def get_jasa_servis_list(
    *,
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    kategori: Optional[str] = None,
    current_user: Any = Depends(get_current_user),
) -> Any:
    """Get list of workshop services."""
    service = JasaServisService(db)
    return service.get_list(skip=skip, limit=limit, search=search, kategori=kategori)


@router.get("/{jasa_id}", response_model=JasaServisResponse)
def get_jasa_servis(
    *,
    db: Session = Depends(get_db),
    jasa_id: int,
    current_user: Any = Depends(get_current_user),
) -> Any:
    """Get workshop service by ID."""
    service = JasaServisService(db)
    return service.get_by_id(jasa_id)


@router.put("/{jasa_id}", response_model=JasaServisResponse)
def update_jasa_servis(
    *,
    db: Session = Depends(get_db),
    jasa_id: int,
    data: JasaServisUpdate,
    current_user: Any = Depends(get_current_user),
) -> Any:
    """Update workshop service."""
    service = JasaServisService(db)
    return service.update(jasa_id, data)


@router.delete("/{jasa_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_jasa_servis(
    *,
    db: Session = Depends(get_db),
    jasa_id: int,
    current_user: Any = Depends(get_current_user),
):
    """Delete workshop service."""
    service = JasaServisService(db)
    service.delete(jasa_id)
