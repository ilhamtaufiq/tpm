from datetime import datetime
from typing import Optional

from sqlalchemy import (
    String,
    Boolean,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    Text,
    Numeric,
)
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
    home_background: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    expo_push_token: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    
    # PIN Security (server-side)
    hashed_pin: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    security_settings: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON string for protected features
    
    # Financial Balance (Catatan Keuangan Cash)
    cash_balance: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))

    # Password Reset
    reset_token: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    reset_token_expires: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Login OTP — kode disimpan di tabel `login_otps`, bukan di sini: satu user
    # bisa punya beberapa login bersamaan dan tiap kode punya sisa percobaan
    # sendiri.

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username='{self.username}', role='{self.role}')>"


class LoginOtp(Base):
    """One pending login OTP.

    A row per issued code, so two concurrent logins for the same user each get
    their own code and attempt counter instead of overwriting one another.
    Only the HMAC of the code is stored.
    """

    __tablename__ = "login_otps"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    otp_hash: Mapped[str] = mapped_column(String(64), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now, nullable=False
    )

    def __repr__(self) -> str:
        return f"<LoginOtp(id={self.id}, user_id={self.user_id})>"
