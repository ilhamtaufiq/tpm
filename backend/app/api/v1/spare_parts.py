from typing import Optional, List, Annotated
from decimal import Decimal
from datetime import datetime

from fastapi import APIRouter, Query, status, File, UploadFile, HTTPException
from fastapi.responses import StreamingResponse
from app.api.deps import DBSession, CurrentUser, ManagerUser
from app.schemas.bengkel import (
    SparePartCreate,
    SparePartUpdate,
    SparePartResponse,
    SparePartList,
)
from app.services.spare_part_service import SparePartService


router = APIRouter(prefix="/spare-parts", tags=["Spare Parts"])


@router.get("/next-kode")
def get_next_kode(
    db: DBSession,
    current_user: CurrentUser,
):
    """Generate the next unique spare part code."""
    service = SparePartService(db)
    return {"kode": service.generate_next_kode()}


@router.post("", response_model=SparePartResponse, status_code=status.HTTP_201_CREATED)
def create_spare_part(
    data: SparePartCreate,
    db: DBSession,
    current_user: ManagerUser,
):
    """Create a new spare part."""
    service = SparePartService(db)
    return service.create(data, current_user.id)


@router.post("/import", status_code=status.HTTP_200_OK)
def import_spare_parts(
    db: DBSession,
    current_user: ManagerUser,
    file: UploadFile = File(...),
):
    """Import spare parts from Excel file."""
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File harus berformat Excel (.xlsx atau .xls)"
        )
    
    contents = file.file.read()
    service = SparePartService(db)
    return service.import_from_excel(contents)


@router.get("", response_model=SparePartList)
def list_spare_parts(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    kategori: Optional[str] = None,
    merek: Optional[str] = None,
    low_stock_only: bool = False,
    sort_by: str = "nama",
    sort_order: str = "asc",
):
    """Get list of spare parts with pagination and filters."""
    service = SparePartService(db)
    return service.get_list(
        skip=skip,
        limit=limit,
        search=search,
        kategori=kategori,
        merek=merek,
        low_stock_only=low_stock_only,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get("/search", response_model=List[SparePartResponse])
def search_spare_parts(
    db: DBSession,
    current_user: CurrentUser,
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=50),
):
    """Search spare parts for transaction form (only items with stock)."""
    service = SparePartService(db)
    return service.search_for_transaction(q, limit)


@router.get("/low-stock", response_model=List[SparePartResponse])
def get_low_stock_items(
    db: DBSession,
    current_user: CurrentUser,
):
    """Get spare parts with low stock."""
    service = SparePartService(db)
    return service.get_low_stock_items()


@router.get("/stock-value")
def get_stock_value(
    db: DBSession,
    current_user: ManagerUser,
):
    """Get total stock value."""
    service = SparePartService(db)
    return service.get_stock_value()


@router.get("/categories", response_model=List[str])
def get_categories(
    db: DBSession,
    current_user: CurrentUser,
):
    """Get distinct categories."""
    service = SparePartService(db)
    return service.get_categories()


@router.get("/brands", response_model=List[str])
def get_brands(
    db: DBSession,
    current_user: CurrentUser,
):
    """Get distinct brands."""
    service = SparePartService(db)
    return service.get_brands()



@router.get("/export")
def export_spare_parts(
    db: DBSession,
    current_user: CurrentUser,
    ids: Annotated[Optional[List[int]], Query()] = None,
):
    """Export spare parts to Excel."""
    service = SparePartService(db)
    output = service.export_to_excel(ids)
    
    filename = f"spare_parts_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/{spare_part_id}", response_model=SparePartResponse)
def get_spare_part(
    spare_part_id: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get spare part by ID."""
    service = SparePartService(db)
    return service.get_by_id(spare_part_id)


@router.put("/{spare_part_id}", response_model=SparePartResponse)
def update_spare_part(
    spare_part_id: int,
    data: SparePartUpdate,
    db: DBSession,
    current_user: ManagerUser,
):
    """Update spare part."""
    service = SparePartService(db)
    return service.update(spare_part_id, data)


@router.post("/{spare_part_id}/image", response_model=SparePartResponse)
def upload_image(
    spare_part_id: int,
    db: DBSession,
    current_user: ManagerUser,
    file: UploadFile = File(...),
):
    """Upload spare part image."""
    service = SparePartService(db)
    return service.upload_image(spare_part_id, file)


@router.patch("/{spare_part_id}/stock", response_model=SparePartResponse)
def update_stock(
    spare_part_id: int,
    quantity: int = Query(...),
    operation: str = Query(..., regex="^(add|subtract)$"),
    db: DBSession = None,
    current_user: ManagerUser = None,
):
    """Update spare part stock manually."""
    service = SparePartService(db)
    return service.update_stock(spare_part_id, quantity, operation)


@router.patch("/{spare_part_id}/price", response_model=SparePartResponse)
def update_price(
    spare_part_id: int,
    db: DBSession,
    current_user: ManagerUser,
    harga_beli: Optional[Decimal] = None,
    harga_jual: Optional[Decimal] = None,
):
    """Update spare part prices."""
    service = SparePartService(db)
    return service.update_price(spare_part_id, harga_beli, harga_jual)


@router.delete("/{spare_part_id}")
def delete_spare_part(
    spare_part_id: int,
    db: DBSession,
    current_user: ManagerUser,
):
    """Delete spare part (soft delete)."""
    service = SparePartService(db)
    service.delete(spare_part_id)
    return {"message": "Spare part berhasil dihapus"}



@router.post("/bulk-delete", status_code=status.HTTP_200_OK)
def bulk_delete_spare_parts(
    ids: List[int],
    db: DBSession,
    current_user: ManagerUser,
):
    """Delete multiple spare parts."""
    service = SparePartService(db)
    count = service.bulk_delete(ids)
    return {"message": f"{count} spare part berhasil dihapus"}
