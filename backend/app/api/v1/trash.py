from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, status

from app.api.deps import DBSession, ManagerUser, AdminUser
from app.services.trash_service import TrashService

router = APIRouter()

@router.get("/{category}")
def get_deleted_items(
    category: str,
    db: DBSession,
    current_user: ManagerUser
):
    """List soft-deleted items for a given category."""
    service = TrashService(db)
    return service.get_deleted_items(category)

@router.post("/{category}/{item_id}/restore")
def restore_item(
    category: str,
    item_id: int,
    db: DBSession,
    current_user: ManagerUser
):
    """Restore a soft-deleted item."""
    service = TrashService(db)
    return {"status": "success", "restored": service.restore_item(category, item_id)}

@router.delete("/{category}/{item_id}/permanent")
def permanent_delete(
    category: str,
    item_id: int,
    db: DBSession,
    current_user: AdminUser
):
    """Permanently delete an item."""
    # current_user: AdminUser dependency already handles the check for ADMIN role
    service = TrashService(db)
    return {"status": "success", "deleted": service.permanent_delete(category, item_id)}
