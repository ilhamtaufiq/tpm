from typing import Optional, List

from fastapi import APIRouter, Query, status

from app.api.deps import DBSession, CurrentUser, ManagerUser
from app.schemas.master import (
    SupplierCreate,
    SupplierUpdate,
    SupplierResponse,
    SupplierList,
)
from app.services.supplier_service import SupplierService


router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


@router.post("", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
def create_supplier(
    data: SupplierCreate,
    db: DBSession,
    current_user: ManagerUser,
):
    """Create a new supplier."""
    service = SupplierService(db)
    return service.create(data)


@router.get("", response_model=SupplierList)
def list_suppliers(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    kota: Optional[str] = None,
    sort_by: str = "nama",
    sort_order: str = "asc",
):
    """Get list of suppliers with pagination and filters."""
    service = SupplierService(db)
    return service.get_list(
        skip=skip,
        limit=limit,
        search=search,
        kota=kota,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get("/search", response_model=List[SupplierResponse])
def search_suppliers(
    db: DBSession,
    current_user: CurrentUser,
    q: Optional[str] = Query(None, min_length=0),
    limit: int = Query(10, ge=1, le=50),
):
    """Search suppliers for autocomplete."""
    service = SupplierService(db)
    return service.search(q, limit)


@router.get("/cities", response_model=List[str])
def get_supplier_cities(
    db: DBSession,
    current_user: CurrentUser,
):
    """Get list of distinct supplier cities."""
    service = SupplierService(db)
    return service.get_cities()


@router.get("/{supplier_id}", response_model=SupplierResponse)
def get_supplier(
    supplier_id: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get supplier by ID."""
    service = SupplierService(db)
    return service.get_by_id(supplier_id)


@router.put("/{supplier_id}", response_model=SupplierResponse)
def update_supplier(
    supplier_id: int,
    data: SupplierUpdate,
    db: DBSession,
    current_user: ManagerUser,
):
    """Update supplier."""
    service = SupplierService(db)
    return service.update(supplier_id, data)


@router.delete("/{supplier_id}")
def delete_supplier(
    supplier_id: int,
    db: DBSession,
    current_user: ManagerUser,
):
    """Delete supplier (soft delete)."""
    service = SupplierService(db)
    service.delete(supplier_id)
    return {"message": "Supplier berhasil dihapus"}
