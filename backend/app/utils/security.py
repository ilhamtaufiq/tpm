import hashlib
import hmac
import secrets
from datetime import datetime, timedelta
from typing import Any

from jose import jwt, JWTError
from passlib.context import CryptContext

from app.config import settings


# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def generate_otp(length: int = 6) -> str:
    """Generate a cryptographically random numeric OTP."""
    return "".join(str(secrets.randbelow(10)) for _ in range(length))


def hash_otp(otp: str) -> str:
    """Keyed hash of an OTP for storage.

    HMAC (not bcrypt) because lookup happens by hash: the verification query
    filters on `otp_hash`, so it must be deterministic. The key is the app
    secret, so a leaked DB alone does not let an attacker precompute the 10^6
    possible codes.
    """
    return hmac.new(
        settings.jwt_secret_key.encode(),
        otp.encode(),
        hashlib.sha256,
    ).hexdigest()


def verify_otp_hash(otp: str, otp_hash: str) -> bool:
    """Constant-time comparison of a candidate OTP against a stored hash."""
    return hmac.compare_digest(hash_otp(otp), otp_hash)


def create_access_token(
    data: dict[str, Any],
    expires_delta: timedelta | None = None,
) -> str:
    """
    Create a JWT access token.

    Args:
        data: Dictionary of claims to encode in the token
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now() + expires_delta
    else:
        expire = datetime.now() + timedelta(
            minutes=settings.access_token_expire_minutes
        )

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    return encoded_jwt


def verify_token(token: str) -> dict[str, Any] | None:
    """
    Verify and decode a JWT token.

    Args:
        token: JWT token string

    Returns:
        Decoded token payload or None if invalid
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        return payload
    except JWTError:
        return None
