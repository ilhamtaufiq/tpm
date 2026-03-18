from datetime import datetime
from typing import Optional

from sqlalchemy import String, Boolean, DateTime, Enum as SQLEnum, Text, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from decimal import Decimal

from app.database.base import Base, TimestampMixin
from app.utils.constants import UserRole


class User(Base, TimestampMixin):
    """User model for authentication and authorization."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    role: Mapped[UserRole] = mapped_column(
        SQLEnum(UserRole),
        default=UserRole.STAFF,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    profile_picture: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # PIN Security (server-side)
    hashed_pin: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    security_settings: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON string for protected features
    
    # Financial Balance (Catatan Keuangan Cash)
    cash_balance: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username='{self.username}', role='{self.role}')>"

