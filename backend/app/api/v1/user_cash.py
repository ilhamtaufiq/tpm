from typing import List, Optional
from decimal import Decimal

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import DBSession, AdminUser
from app.schemas.user import UserResponse, UserCashAdjustmentCreate, UserCashAdjustmentResponse
from app.services.user_cash_service import UserCashService


router = APIRouter(prefix="/user-cash", tags=["User Cash Management"])


@router.get("/users", response_model=List[UserResponse])
def list_users_with_balances(
    db: DBSession,
    current_user: AdminUser,
):
    """Get all users and their current cash balances (Admin Only)."""
    service = UserCashService(db)
    return service.get_user_list()


@router.post("/{user_id}/adjust", response_model=UserResponse)
def adjust_user_balance(
    user_id: int,
    data: UserCashAdjustmentCreate,
    db: DBSession,
    current_user: AdminUser,
):
    """Increment or decrement a user's cash balance (Admin Only)."""
    service = UserCashService(db)
    return service.adjust_balance(user_id, current_user.id, data)


@router.post("/{user_id}/set", response_model=UserResponse)
def set_user_balance(
    user_id: int,
    db: DBSession,
    current_user: AdminUser,
    nominal: Decimal = Query(..., description="Target balance value"),
    keterangan: Optional[str] = Query(None),
):
    """Set a user's cash balance to a specific value (Admin Only)."""
    service = UserCashService(db)
    return service.set_balance(user_id, current_user.id, nominal, keterangan or "Managemen Saldo oleh Admin")


@router.get("/history", response_model=List[UserCashAdjustmentResponse])
def get_adjustment_history(
    db: DBSession,
    current_user: AdminUser,
    user_id: Optional[int] = None,
    limit: int = 50,
):
    """Get history of cash balance adjustments (Admin Only)."""
    service = UserCashService(db)
    return service.get_history(user_id, limit)
