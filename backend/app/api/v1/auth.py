from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import DBSession, CurrentUser, AdminUser
from app.schemas.user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserLogin,
    Token,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
import os
import uuid
from app.config import settings
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


@router.post("/me/avatar", response_model=UserResponse)
async def upload_avatar(
    db: DBSession,
    current_user: CurrentUser,
    file: UploadFile = File(...),
):
    """
    Upload a new profile picture for the current user.
    """
    print(f"[Upload Avatar] Received file: {file.filename}, Content-Type: {file.content_type}")
    
    # Validate file type
    if not file.content_type.startswith("image/"):
        print(f"[Upload Avatar] Invalid file type: {file.content_type}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image",
        )

    # Validate file size
    file_size = 0
    contents = await file.read()
    file_size = len(contents)
    print(f"[Upload Avatar] File size: {file_size} bytes")
    
    if file_size > settings.max_file_size:
        print(f"[Upload Avatar] File too large: {file_size} > {settings.max_file_size}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Max size is {settings.max_file_size / (1024 * 1024)}MB",
        )
    await file.seek(0)

    # Generate unique filename
    extension = os.path.splitext(file.filename)[1]
    if not extension:
        # Fallback if no extension
        if file.content_type == "image/jpeg": extension = ".jpg"
        elif file.content_type == "image/png": extension = ".png"
        else: extension = ".png"
        
    filename = f"avatar_{current_user.id}_{uuid.uuid4().hex}{extension}"
    
    # Save file
    upload_path = os.path.realpath(settings.upload_full_path)
    file_path = os.path.join(upload_path, filename)
    print(f"[Upload Avatar] Target path: {file_path}")
    
    try:
        with open(file_path, "wb") as f:
            f.write(contents)
        print(f"[Upload Avatar] File saved successfully")
    except Exception as e:
        print(f"[Upload Avatar] ERROR saving file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error saving file: {str(e)}",
        )

    # Generate URI for the database
    # Assuming the app serves the upload directory at /uploads/
    avatar_uri = f"/{settings.upload_dir}/{filename}"
    print(f"[Upload Avatar] New URI: {avatar_uri}")

    # Update user record
    service = AuthService(db)
    
    # Delete old file if it exists and is local
    if current_user.profile_picture and current_user.profile_picture.startswith(f"/{settings.upload_dir}/"):
        old_filename = current_user.profile_picture.split("/")[-1]
        old_file_path = os.path.join(upload_path, old_filename)
        if os.path.exists(old_file_path):
            try:
                os.remove(old_file_path)
            except Exception as e:
                print(f"Error removing old avatar: {e}")

    return service.update_avatar(current_user.id, avatar_uri)


@router.post("/me/home-background", response_model=UserResponse)
async def upload_home_background(
    db: DBSession,
    current_user: CurrentUser,
    file: UploadFile = File(...),
):
    """
    Upload a new home screen background image for the current user.
    """
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image",
        )

    # Validate file size
    file_size = 0
    contents = await file.read()
    file_size = len(contents)
    if file_size > settings.max_file_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Max size is {settings.max_file_size / (1024 * 1024)}MB",
        )
    await file.seek(0)

    # Generate unique filename
    extension = os.path.splitext(file.filename)[1]
    if not extension:
        # Fallback if no extension
        if file.content_type == "image/jpeg": extension = ".jpg"
        elif file.content_type == "image/png": extension = ".png"
        else: extension = ".png"
        
    filename = f"bg_{current_user.id}_{uuid.uuid4().hex}{extension}"
    
    # Save file
    upload_path = os.path.realpath(settings.upload_full_path)
    file_path = os.path.join(upload_path, filename)
    
    with open(file_path, "wb") as f:
        f.write(contents)

    # Generate URI for the database
    background_uri = f"/{settings.upload_dir}/{filename}"

    # Update user record
    service = AuthService(db)
    
    # Delete old file if it exists and is local
    if current_user.home_background and current_user.home_background.startswith(f"/{settings.upload_dir}/"):
        old_filename = current_user.home_background.split("/")[-1]
        old_file_path = os.path.join(upload_path, old_filename)
        if os.path.exists(old_file_path):
            try:
                os.remove(old_file_path)
            except Exception as e:
                print(f"Error removing old background: {e}")

    return service.update_home_background(current_user.id, background_uri)


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


@router.post("/forgot-password")
def forgot_password(
    data: ForgotPasswordRequest,
    db: DBSession,
):
    """
    Request a password reset.
    """
    service = AuthService(db)
    service.forgot_password(data.email)
    return {"message": "Jika email terdaftar di sistem kami, instruksi untuk mereset password telah dikirim ke email tersebut."}


@router.post("/reset-password")
def reset_password(
    data: ResetPasswordRequest,
    db: DBSession,
):
    """
    Reset password using a token.
    """
    service = AuthService(db)
    service.reset_password(data.token, data.new_password)
    return {"message": "Password Anda telah berhasil diperbarui."}
