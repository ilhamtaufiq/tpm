from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field
from decimal import Decimal
from app.utils.constants import UserRole


class UserBase(BaseModel):
    """Base user schema with common fields."""

    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    role: UserRole = UserRole.STAFF


class UserCreate(UserBase):
    """Schema for creating a new user."""

    password: str = Field(..., min_length=6, max_length=100)


class UserUpdate(BaseModel):
    """Schema for updating a user."""

    username: Optional[str] = Field(None, min_length=3, max_length=50)
    email: Optional[EmailStr] = None
    full_name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=6, max_length=100)
    profile_picture: Optional[str] = None


class UserResponse(BaseModel):
    """Schema for user response."""

    id: int
    username: str
    email: str
    full_name: str
    phone: Optional[str] = None
    role: UserRole
    is_active: bool
    last_login: Optional[datetime] = None
    profile_picture: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    cash_balance: Decimal = Decimal("0")

    model_config = {"from_attributes": True}


class UserCashAdjustmentCreate(BaseModel):
    """Schema for adjusting user cash balance."""

    nominal: Decimal = Field(..., description="Positive to add, negative to subtract")
    keterangan: Optional[str] = Field(None, max_length=255)


class UserCashAdjustmentResponse(BaseModel):
    """Schema for user cash adjustment log response."""

    id: int
    user_id: int
    admin_id: int
    target_user_name: Optional[str] = None
    admin_name: Optional[str] = None
    saldo_sebelum: Decimal
    saldo_sesudah: Decimal
    nominal: Decimal
    keterangan: Optional[str] = None
    created_at: datetime


    model_config = {"from_attributes": True}



class UserLogin(BaseModel):
    """Schema for user login."""

    username: str
    password: str


class Token(BaseModel):
    """Schema for JWT token response."""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenPayload(BaseModel):
    """Schema for JWT token payload."""

    sub: str  # user_id
    username: str
    role: UserRole
    exp: datetime
