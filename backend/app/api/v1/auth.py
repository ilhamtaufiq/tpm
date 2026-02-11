from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import DBSession, CurrentUser, AdminUser
from app.schemas.user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserLogin,
    Token,
)
from app.services.auth_service import AuthService


router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    user_data: UserCreate,
    db: DBSession,
    current_user: AdminUser,  # Only admin can create users
):
    """
    Register a new user.

    Requires admin privileges.
    """
    service = AuthService(db)
    return service.create_user(user_data)


@router.post("/login", response_model=Token)
def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: DBSession,
):
    """
    Login and get access token.

    Uses OAuth2 password flow.
    """
    service = AuthService(db)
    return service.authenticate(form_data.username, form_data.password)


@router.post("/login/json", response_model=Token)
def login_json(
    login_data: UserLogin,
    db: DBSession,
):
    """
    Login with JSON body and get access token.

    Alternative to OAuth2 form for easier frontend integration.
    """
    service = AuthService(db)
    return service.authenticate(login_data.username, login_data.password)


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: CurrentUser):
    """Get current user information."""
    return current_user


@router.put("/me", response_model=UserResponse)
def update_current_user(
    user_data: UserUpdate,
    db: DBSession,
    current_user: CurrentUser,
):
    """Update current user information."""
    # Don't allow changing role via this endpoint
    if user_data.role is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot change role via this endpoint",
        )

    service = AuthService(db)
    return service.update_user(current_user.id, user_data)


@router.post("/change-password")
def change_password(
    old_password: str,
    new_password: str,
    db: DBSession,
    current_user: CurrentUser,
):
    """Change current user password."""
    service = AuthService(db)
    service.change_password(current_user.id, old_password, new_password)
    return {"message": "Password changed successfully"}


# Admin endpoints for user management
@router.get("/users", response_model=list[UserResponse])
def list_users(
    db: DBSession,
    current_user: AdminUser,
    skip: int = 0,
    limit: int = 20,
    is_active: Optional[bool] = None,
):
    """
    List all users.

    Requires admin privileges.
    """
    service = AuthService(db)
    return service.get_users(skip=skip, limit=limit, is_active=is_active)


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: DBSession,
    current_user: AdminUser,
):
    """
    Get user by ID.

    Requires admin privileges.
    """
    service = AuthService(db)
    user = service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: DBSession,
    current_user: AdminUser,
):
    """
    Update user by ID.

    Requires admin privileges.
    """
    service = AuthService(db)
    return service.update_user(user_id, user_data)


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: DBSession,
    current_user: AdminUser,
):
    """
    Delete (deactivate) user by ID.

    Requires admin privileges.
    """
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself",
        )

    service = AuthService(db)
    service.delete_user(user_id)
    return {"message": "User deactivated successfully"}
