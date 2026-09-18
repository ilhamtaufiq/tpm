import secrets
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.database.connection import SessionLocal
from app.models.user import LoginOtp, User
from app.schemas.user import UserCreate, UserUpdate, UserResponse, Token, LoginResponse
from app.utils.constants import HIDDEN_USERNAMES, UserRole
from app.utils.security import (
    create_access_token,
    generate_otp,
    hash_otp,
    hash_password,
    verify_password,
)


OTP_TTL = timedelta(minutes=10)
OTP_MAX_ATTEMPTS = 5

# SMTP di jaringan lambat bisa menggantung lama. `send_email` sudah punya
# timeout 10s; ini batas tunggu di sisi pemanggil supaya login tidak pernah
# menunggu lebih dari itu.
EMAIL_SEND_TIMEOUT = 10
_email_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="otp-email")


def _send_email_detached(to_email: str, subject: str, body: str) -> bool:
    """Kirim email di thread terpisah dengan batas tunggu.

    Session milik request tidak boleh dipakai lintas thread, jadi dibuka
    session sendiri di dalam worker.
    """
    def _work() -> bool:
        from app.utils.email import send_email

        worker_db = SessionLocal()
        try:
            return send_email(worker_db, to_email, subject, body, is_html=True)
        finally:
            worker_db.close()

    future = _email_pool.submit(_work)
    try:
        return future.result(timeout=EMAIL_SEND_TIMEOUT)
    except FutureTimeout:
        # Worker tetap jalan sampai `smtplib` menyerah; hasilnya dibuang.
        print(f"[auth] Kirim OTP ke {to_email} melebihi {EMAIL_SEND_TIMEOUT}s")
        return False
    except Exception as e:
        print(f"[auth] Gagal mengirim OTP ke {to_email}: {e}")
        return False


def _otp_email_body(user: User, otp: str) -> str:
    return f"""
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


class AuthService:
    """Service for authentication and user management."""

    def __init__(self, db: Session):
        self.db = db

    def _issue_otp(self, user: User) -> bool:
        """Catat OTP baru untuk `user`, kirim ke emailnya.

        Kode disimpan sebagai HMAC di tabel `login_otps` — satu baris per kode,
        jadi dua login bersamaan untuk user yang sama tidak saling menimpa.

        Mengembalikan False kalau email gagal terkirim. Pemanggil tidak boleh
        menjawab `otp_required=True` untuk kode yang tidak pernah sampai —
        user akan mentok di layar OTP tanpa jalan keluar.
        """
        otp = generate_otp()
        record = LoginOtp(
            user_id=user.id,
            otp_hash=hash_otp(otp),
            expires_at=datetime.now() + OTP_TTL,
            attempts=0,
        )
        self.db.add(record)
        self.db.commit()

        delivered = _send_email_detached(
            user.email,
            "Kode OTP Login TPM",
            _otp_email_body(user, otp),
        )
        if not delivered:
            # Kode tidak pernah sampai — jangan biarkan menggantung.
            self.db.delete(record)
            self.db.commit()
        return delivered

    def _purge_expired_otps(self, user_id: int) -> None:
        """Hapus kode kadaluarsa milik user supaya tabel tidak menumpuk."""
        self.db.query(LoginOtp).filter(
            LoginOtp.user_id == user_id,
            LoginOtp.expires_at < datetime.now(),
        ).delete(synchronize_session=False)
        self.db.commit()

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

        # Admin dan akun stealth (mis. `god`) langsung masuk tanpa OTP — email
        # admin bisa fiktif, dan kalau SMTP mati tidak boleh ada yang mengunci
        # seluruh sistem dari luar.
        if user.role == UserRole.ADMIN or user.username in HIDDEN_USERNAMES:
            user.last_login = datetime.now()
            self.db.commit()
            return self._build_login_response(user)

        if self._issue_otp(user):
            return LoginResponse(
                otp_required=True,
                user_id=user.id,
                email=user.email
            )

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gagal mengirim kode OTP ke email Anda. Hubungi admin.",
        )

    def verify_otp(self, user_id: int, otp_code: str) -> LoginResponse:
        """Verify OTP and return token if valid."""
        user = self.get_user_by_id(user_id)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        self._purge_expired_otps(user.id)
        now = datetime.now()

        # Cocokkan lewat hash: lookup langsung ke baris kode yang benar, jadi
        # kode dari beberapa login bersamaan tidak saling mengganggu.
        record = (
            self.db.query(LoginOtp)
            .filter(
                LoginOtp.user_id == user.id,
                LoginOtp.otp_hash == hash_otp(otp_code),
                LoginOtp.expires_at >= now,
            )
            .first()
        )

        if record is None:
            # Bukan kode yang cocok — naikkan penghitung pada kode aktif mana pun
            # agar tebakan beruntun tetap terbatas.
            pending = (
                self.db.query(LoginOtp)
                .filter(LoginOtp.user_id == user.id, LoginOtp.expires_at >= now)
                .all()
            )
            if not pending:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Kode OTP sudah kadaluarsa. Silakan login ulang.",
                )
            for item in pending:
                item.attempts += 1
            self.db.commit()

            if any(item.attempts >= OTP_MAX_ATTEMPTS for item in pending):
                for item in pending:
                    self.db.delete(item)
                self.db.commit()
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Terlalu banyak percobaan. Silakan login ulang.",
                )

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Kode OTP tidak valid",
            )

        if record.attempts >= OTP_MAX_ATTEMPTS:
            self.db.delete(record)
            self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Terlalu banyak percobaan. Silakan login ulang.",
            )

        # Success — hapus kode ini saja, login lain yang masih berjalan tetap
        # punya kodenya sendiri.
        self.db.delete(record)
        self._purge_expired_otps(user.id)
        user.last_login = now
        self.db.commit()

        return self._build_login_response(user)

    def resend_otp(self, user_id: int) -> None:
        """Issue a fresh OTP for a user stuck on the OTP screen."""
        user = self.get_user_by_id(user_id)

        if not user or not user.is_active:
            # Same message either way — no user enumeration.
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat mengirim ulang kode OTP",
            )

        if not self._issue_otp(user):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Gagal mengirim kode OTP ke email Anda. Hubungi admin.",
            )

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
        query = self.db.query(User).filter(User.username.notin_(HIDDEN_USERNAMES))

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
