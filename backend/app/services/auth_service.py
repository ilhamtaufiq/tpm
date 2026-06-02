from datetime import datetime, timedelta
import secrets
from typing import Optional

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate, UserResponse, Token, LoginResponse
from app.utils.constants import UserRole
from app.utils.security import (
    hash_password,
    verify_password,
    create_access_token,
)


class AuthService:
    """Service for authentication and user management."""

    def __init__(self, db: Session):
        self.db = db

    def create_user(self, user_data: UserCreate) -> User:
        """Create a new user."""
        # Check if username exists
        if self.get_user_by_username(user_data.username):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already registered",
            )

        # Check if email exists
        if self.get_user_by_email(user_data.email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )

        # Create user
        user = User(
            username=user_data.username,
            email=user_data.email,
            full_name=user_data.full_name,
            phone=user_data.phone,
            hashed_password=hash_password(user_data.password),
            role=user_data.role,
        )

        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

        return user

    def _build_login_response(
        self,
        user: User,
        *,
        impersonator: Optional[User] = None,
    ) -> LoginResponse:
        access_token = create_access_token(
            data={
                "sub": str(user.id),
                "username": user.username,
                "role": user.role.value,
                "is_impersonation": impersonator is not None,
                "impersonated_by": str(impersonator.id) if impersonator else None,
            }
        )

        return LoginResponse(
            access_token=access_token,
            user=UserResponse.model_validate(user),
            is_impersonation=impersonator is not None,
            impersonator=UserResponse.model_validate(impersonator) if impersonator else None,
        )

    def authenticate(self, username: str, password: str) -> LoginResponse:
        """Authenticate user and return token or OTP requirement."""
        from app.utils.email import send_email
        import random
        
        user = self.get_user_by_username(username)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
            )

        if not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is inactive",
            )

        # OTP requirement for roles other than ADMIN
        if user.role != UserRole.ADMIN:
            # Generate OTP
            otp = "".join([str(random.randint(0, 9)) for _ in range(6)])
            user.otp_code = otp
            user.otp_expires = datetime.now() + timedelta(minutes=10)
            self.db.commit()
            
            # Send OTP email
            subject = "Kode OTP Login TPM"
            body = f"""
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #023C69;">Halo {user.full_name},</h2>
                    <p>Seseorang sedang login ke akun TPM Anda. Jika ini Anda, gunakan kode OTP berikut untuk melanjutkan:</p>
                    <div style="text-align: center; margin: 30px 0; background-color: #f9f9f9; padding: 20px; border-radius: 8px;">
                        <span style="font-size: 32px; font-weight: bold; color: #023C69; letter-spacing: 5px;">{otp}</span>
                    </div>
                    <p>Kode ini akan kadaluarsa dalam 10 menit. <strong>Jangan bagikan kode ini kepada siapa pun.</strong></p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
                    <p>Terima kasih,<br><strong>Tim TPM</strong></p>
                </div>
            </body>
            </html>
            """
            send_email(self.db, user.email, subject, body, is_html=True)
            
            return LoginResponse(
                otp_required=True,
                user_id=user.id,
                email=user.email
            )

        # Admin login (direct)
        user.last_login = datetime.now()
        self.db.commit()

        return self._build_login_response(user)

    def verify_otp(self, user_id: int, otp_code: str) -> LoginResponse:
        """Verify OTP and return token if valid."""
        user = self.get_user_by_id(user_id)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
            
        if not user.otp_code or user.otp_code != otp_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Kode OTP tidak valid",
            )
            
        if not user.otp_expires or user.otp_expires < datetime.now():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Kode OTP sudah kadaluarsa",
            )
            
        # Success - Clear OTP and return token
        user.otp_code = None
        user.otp_expires = None
        user.last_login = datetime.now()
        self.db.commit()

        return self._build_login_response(user)

    def impersonate_user(self, admin_user_id: int, target_user_id: int) -> LoginResponse:
        admin_user = self.get_user_by_id(admin_user_id)
        target_user = self.get_user_by_id(target_user_id)

        if not admin_user or admin_user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Hanya admin yang dapat menggunakan impersonate",
            )

        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User target tidak ditemukan",
            )

        if target_user.id == admin_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat impersonate akun sendiri",
            )

        if target_user.role == UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impersonate ke sesama admin tidak diizinkan",
            )

        if not target_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User target tidak aktif",
            )

        return self._build_login_response(target_user, impersonator=admin_user)

    def get_user_by_id(self, user_id: int) -> Optional[User]:
        """Get user by ID."""
        return self.db.query(User).filter(User.id == user_id).first()

    def get_user_by_username(self, username: str) -> Optional[User]:
        """Get user by username."""
        return self.db.query(User).filter(User.username == username).first()

    def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email."""
        return self.db.query(User).filter(User.email == email).first()

    def get_users(
        self,
        skip: int = 0,
        limit: int = 20,
        is_active: Optional[bool] = None,
    ) -> list[User]:
        """Get list of users with pagination."""
        query = self.db.query(User)

        if is_active is not None:
            query = query.filter(User.is_active == is_active)

        return query.offset(skip).limit(limit).all()

    def update_user(self, user_id: int, user_data: UserUpdate) -> User:
        """Update user details."""
        user = self.get_user_by_id(user_id)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        update_data = user_data.model_dump(exclude_unset=True)

        # Hash password if provided
        if "password" in update_data:
            update_data["hashed_password"] = hash_password(update_data.pop("password"))

        # Check username uniqueness if changing
        if "username" in update_data and update_data["username"] != user.username:
            if self.get_user_by_username(update_data["username"]):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username already taken",
                )

        # Check email uniqueness if changing
        if "email" in update_data and update_data["email"] != user.email:
            if self.get_user_by_email(update_data["email"]):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered",
                )

        for field, value in update_data.items():
            setattr(user, field, value)

        self.db.commit()
        self.db.refresh(user)

        return user

    def update_avatar(self, user_id: int, avatar_uri: str) -> User:
        """Update user profile picture URL."""
        user = self.get_user_by_id(user_id)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        user.profile_picture = avatar_uri
        self.db.commit()
        self.db.refresh(user)

        return user

    def update_home_background(self, user_id: int, background_uri: str) -> User:
        """Update user home screen background URL."""
        user = self.get_user_by_id(user_id)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        user.home_background = background_uri
        self.db.commit()
        self.db.refresh(user)

        return user

    def set_push_token(self, user_id: int, expo_push_token: str) -> User:
        """Store or update a user's Expo push token."""
        user = self.get_user_by_id(user_id)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        user.expo_push_token = expo_push_token.strip()
        self.db.commit()
        self.db.refresh(user)
        return user

    def clear_push_token(self, user_id: int) -> User:
        """Clear a user's Expo push token."""
        user = self.get_user_by_id(user_id)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        user.expo_push_token = None
        self.db.commit()
        self.db.refresh(user)
        return user

    def delete_user(self, user_id: int) -> bool:
        """Delete a user (soft delete by deactivating)."""
        user = self.get_user_by_id(user_id)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        user.is_active = False
        self.db.commit()

        return True

    def change_password(
        self,
        user_id: int,
        old_password: str,
        new_password: str,
    ) -> bool:
        """Change user password."""
        user = self.get_user_by_id(user_id)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        if not verify_password(old_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect current password",
            )

        user.hashed_password = hash_password(new_password)
        self.db.commit()

        return True

    def forgot_password(self, email: str) -> bool:
        """Process forgot password request."""
        user = self.get_user_by_email(email)
        
        # We return True even if user not found to prevent user enumeration
        if not user:
            return True
            
        # Generate token
        token = secrets.token_urlsafe(32)
        user.reset_token = token
        user.reset_token_expires = datetime.now() + timedelta(hours=1)
        
        self.db.commit()
        
        # Send email
        from app.utils.email import send_password_reset_email
        return send_password_reset_email(self.db, user.email, token, user.full_name)

    def reset_password(self, token: str, new_password: str) -> bool:
        """Reset password using token."""
        user = self.db.query(User).filter(
            User.reset_token == token,
            User.reset_token_expires > datetime.now()
        ).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token tidak valid atau sudah kadaluarsa",
            )
            
        user.hashed_password = hash_password(new_password)
        user.reset_token = None
        user.reset_token_expires = None
        
        self.db.commit()
        
        return True
