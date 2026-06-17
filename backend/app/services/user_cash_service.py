from decimal import Decimal
from typing import List, Optional

from sqlalchemy import select, desc
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from app.models.user import User
from app.models.keuangan import UserCashAdjustment
from app.schemas.user import UserCashAdjustmentCreate
from app.realtime import publish_realtime_event


class UserCashService:
    """Service for managing user cash balances (Catatan Keuangan Cash)."""

    def __init__(self, db: Session):
        self.db = db

    def get_user_list(self) -> List[User]:
        """Get all active users with their cash balances."""
        stmt = select(User).where(User.is_active == True).order_by(User.full_name)
        return self.db.execute(stmt).scalars().all()

    def adjust_balance(
        self, user_id: int, admin_id: int, data: UserCashAdjustmentCreate
    ) -> User:
        """Adjust a user's cash balance and log the adjustment."""
        # Get target user
        user = self.db.get(User, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User tidak ditemukan",
            )

        # Record current state
        saldo_sebelum = user.cash_balance
        saldo_sesudah = saldo_sebelum + data.nominal

        # Update user balance
        user.cash_balance = saldo_sesudah

        # Create adjustment log
        adjustment = UserCashAdjustment(
            user_id=user_id,
            admin_id=admin_id,
            saldo_sebelum=saldo_sebelum,
            saldo_sesudah=saldo_sesudah,
            nominal=data.nominal,
            keterangan=data.keterangan,
        )
        self.db.add(adjustment)
        self.db.commit()
        self.db.refresh(user)
        publish_realtime_event(
            event="users.cash.updated",
            scope="users",
            entity="user_cash",
            action="adjusted",
            entity_id=user_id,
            data={"nominal": float(data.nominal)},
        )

        return user

    def set_balance(
        self, user_id: int, admin_id: int, target_balance: Decimal, keterangan: str = "Set balance by admin"
    ) -> User:
        """Set a user's cash balance to a specific value and log the adjustment."""
        user = self.db.get(User, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User tidak ditemukan",
            )

        saldo_sebelum = user.cash_balance
        nominal = target_balance - saldo_sebelum
        saldo_sesudah = target_balance

        # Update user balance
        user.cash_balance = saldo_sesudah

        # Create adjustment log
        adjustment = UserCashAdjustment(
            user_id=user_id,
            admin_id=admin_id,
            saldo_sebelum=saldo_sebelum,
            saldo_sesudah=saldo_sesudah,
            nominal=nominal,
            keterangan=keterangan,
        )
        self.db.add(adjustment)
        self.db.commit()
        self.db.refresh(user)
        publish_realtime_event(
            event="users.cash.updated",
            scope="users",
            entity="user_cash",
            action="set",
            entity_id=user_id,
            data={"nominal": float(nominal)},
        )

        return user

    def get_history(self, user_id: Optional[int] = None, limit: int = 50) -> List[UserCashAdjustment]:
        """Get modification history for user cash balances."""
        stmt = (
            select(UserCashAdjustment)
            .options(joinedload(UserCashAdjustment.user), joinedload(UserCashAdjustment.admin))
            .order_by(desc(UserCashAdjustment.created_at))
            .limit(limit)
        )
        if user_id:
            stmt = stmt.where(UserCashAdjustment.user_id == user_id)
        
        return self.db.execute(stmt).scalars().all()
