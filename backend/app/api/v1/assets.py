from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import DBSession, CurrentUser, ManagerUser
from app.services.asset_service import AssetService
from app.schemas.keuangan import AssetCreate, AssetUpdate, AssetResponse, AssetList
from app.utils.constants import AssetStatus

router = APIRouter(prefix="/assets", tags=["Assets"])


@router.post("", response_model=AssetResponse)
def create_asset(
    obj_in: AssetCreate,
    db: DBSession,
    current_user: ManagerUser,
):
    """Create new asset."""
    service = AssetService(db)
    return service.create(obj_in, current_user.id)


@router.get("", response_model=AssetList)
def get_assets(
    db: DBSession,
    current_user: ManagerUser,
    page: int = 1,
    size: int = 20,
    search: Optional[str] = None,
    kategori: Optional[str] = None,
    status: Optional[AssetStatus] = None,
):
    """Retrieve assets."""
    service = AssetService(db)
    skip = (page - 1) * size
    result = service.get_list(skip=skip, limit=size, search=search, kategori=kategori, status=status)
    
    return {
        **result,
        "page": page,
        "size": size,
        "pages": (result["total"] + size - 1) // size,
    }


@router.get("/{id}", response_model=AssetResponse)
def get_asset(
    id: int,
    db: DBSession,
    current_user: ManagerUser,
):
    """Get asset by ID."""
    service = AssetService(db)
    asset = service.get(id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.put("/{id}", response_model=AssetResponse)
def update_asset(
    id: int,
    obj_in: AssetUpdate,
    db: DBSession,
    current_user: ManagerUser,
):
    """Update asset."""
    service = AssetService(db)
    asset = service.update(id, obj_in)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.delete("/{id}")
def delete_asset(
    id: int,
    db: DBSession,
    current_user: ManagerUser,
):
    """Delete asset."""
    service = AssetService(db)
    if not service.delete(id):
        raise HTTPException(status_code=404, detail="Asset not found")
    return {"message": "Asset deleted successfully"}


@router.get("/summary/stats")
def get_asset_summary(
    db: DBSession,
    current_user: ManagerUser,
):
    """Get asset summary."""
    service = AssetService(db)
    return service.get_summary()
