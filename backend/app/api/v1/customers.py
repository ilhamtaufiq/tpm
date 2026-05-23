from typing import Optional, List

from fastapi import APIRouter, Query, status

from app.api.deps import DBSession, CurrentUser, UnitManagerUser
from app.schemas.master import (
    CustomerCreate,
    CustomerUpdate,
    CustomerResponse,
    CustomerList,
)
from app.services.customer_service import CustomerService


router = APIRouter(prefix="/customers", tags=["Customers"])


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(
    data: CustomerCreate,
    db: DBSession,
    current_user: UnitManagerUser,
):
    """Create a new customer."""
    service = CustomerService(db)
    return service.create(data)


@router.get("", response_model=CustomerList)
def list_customers(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    tipe: Optional[str] = None,
    kota: Optional[str] = None,
    sort_by: str = "nama",
    sort_order: str = "asc",
):
    """Get list of customers with pagination and filters."""
    service = CustomerService(db)
    return service.get_list(
        skip=skip,
        limit=limit,
        search=search,
        tipe=tipe,
        kota=kota,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get("/search", response_model=List[CustomerResponse])
def search_customers(
    db: DBSession,
    current_user: CurrentUser,
    q: Optional[str] = Query(None, min_length=0),
    limit: int = Query(10, ge=1, le=50),
):
    """Search customers for autocomplete."""
    service = CustomerService(db)
    return service.search(q, limit)


@router.get("/cities", response_model=List[str])
def get_customer_cities(
    db: DBSession,
    current_user: CurrentUser,
):
    """Get list of distinct customer cities."""
    service = CustomerService(db)
    return service.get_cities()


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get customer by ID."""
    service = CustomerService(db)
    return service.get_by_id(customer_id)


@router.get("/{customer_id}/summary")
def get_customer_summary(
    customer_id: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get customer summary with transaction history."""
    service = CustomerService(db)
    return service.get_summary(customer_id)


@router.get("/{customer_id}/piutang")
def get_customer_piutang(
    customer_id: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get customer receivables."""
    service = CustomerService(db)
    return service.get_piutang(customer_id)


@router.get("/{customer_id}/transactions")
def get_customer_transactions(
    customer_id: int,
    db: DBSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    source: Optional[str] = None,
):
    """Get customer transaction history."""
    service = CustomerService(db)
    return service.get_transaction_history(
        customer_id,
        skip=skip,
        limit=limit,
        source=source,
    )


@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: int,
    data: CustomerUpdate,
    db: DBSession,
    current_user: UnitManagerUser,
):
    """Update customer."""
    service = CustomerService(db)
    return service.update(customer_id, data)


@router.delete("/{customer_id}")
def delete_customer(
    customer_id: int,
    db: DBSession,
    current_user: UnitManagerUser,
):
    """Delete customer (soft delete)."""
    service = CustomerService(db)
    service.delete(customer_id)
    return {"message": "Customer berhasil dihapus"}
