import json
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import DBSession, CurrentUser
from app.models.user import User
from app.utils.security import hash_password, verify_password


router = APIRouter(prefix="/security", tags=["Security"])


# ─── Schemas ───────────────────────────────────────────────

class PinSetup(BaseModel):
    pin: str = Field(..., min_length=4, max_length=6)

class PinVerify(BaseModel):
    pin: str = Field(..., min_length=4, max_length=6)

class PinChange(BaseModel):
    old_pin: str = Field(..., min_length=4, max_length=6)
    new_pin: str = Field(..., min_length=4, max_length=6)

class SecuritySettingsUpdate(BaseModel):
    app_lock: Optional[bool] = None
    finance: Optional[bool] = None
    bengkel: Optional[bool] = None
    jasa_angkut: Optional[bool] = None
    laporan: Optional[bool] = None
    master_data: Optional[bool] = None
    mobil: Optional[bool] = None
    sdm: Optional[bool] = None
    settings: Optional[bool] = None
    disable_web_access: Optional[bool] = None


DEFAULT_SETTINGS = {
    "app_lock": True,
    "finance": True,
    "bengkel": False,
    "jasa_angkut": False,
    "laporan": True,
    "master_data": False,
    "mobil": False,
    "sdm": False,
    "settings": False,
    "disable_web_access": False,
}


# ─── Helpers ───────────────────────────────────────────────

def _get_settings(user: User) -> dict:
    """Parse security_settings JSON from user, fallback to defaults."""
    if user.security_settings:
        try:
            return json.loads(user.security_settings)
        except json.JSONDecodeError:
            pass
    return dict(DEFAULT_SETTINGS)


# ─── Endpoints ─────────────────────────────────────────────

@router.get("/status")
def get_security_status(current_user: CurrentUser):
    """Get current user's security status."""
    settings = _get_settings(current_user)
    return {
        "is_pin_enabled": current_user.hashed_pin is not None,
        "protected_features": settings,
    }


@router.post("/pin/setup")
def setup_pin(
    data: PinSetup,
    db: DBSession,
    current_user: CurrentUser,
):
    """Set up a new PIN for the current user."""
    if current_user.hashed_pin is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN sudah aktif. Gunakan endpoint /pin/change untuk mengubah, atau /pin/disable untuk menonaktifkan.",
        )

    current_user.hashed_pin = hash_password(data.pin)
    
    # Set default settings if not yet configured
    if not current_user.security_settings:
        current_user.security_settings = json.dumps(DEFAULT_SETTINGS)
    
    db.commit()
    return {"message": "PIN berhasil diatur", "is_pin_enabled": True}


@router.post("/pin/verify")
def verify_pin(
    data: PinVerify,
    current_user: CurrentUser,
):
    """Verify PIN for the current user."""
    if not current_user.hashed_pin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN belum diatur.",
        )

    if not verify_password(data.pin, current_user.hashed_pin):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN salah.",
        )

    return {"valid": True, "message": "PIN benar"}


@router.post("/pin/change")
def change_pin(
    data: PinChange,
    db: DBSession,
    current_user: CurrentUser,
):
    """Change PIN — requires old PIN verification."""
    if not current_user.hashed_pin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN belum diatur. Gunakan endpoint /pin/setup.",
        )

    if not verify_password(data.old_pin, current_user.hashed_pin):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN lama salah.",
        )

    current_user.hashed_pin = hash_password(data.new_pin)
    db.commit()
    return {"message": "PIN berhasil diubah"}


@router.post("/pin/disable")
def disable_pin(
    data: PinVerify,
    db: DBSession,
    current_user: CurrentUser,
):
    """Disable PIN — requires PIN verification first."""
    if not current_user.hashed_pin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN belum diatur.",
        )

    if not verify_password(data.pin, current_user.hashed_pin):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN salah.",
        )

    current_user.hashed_pin = None
    db.commit()
    return {"message": "PIN berhasil dinonaktifkan", "is_pin_enabled": False}


@router.put("/settings")
def update_security_settings(
    data: SecuritySettingsUpdate,
    db: DBSession,
    current_user: CurrentUser,
):
    """Update protected features settings."""
    current_settings = _get_settings(current_user)

    # Merge only provided (non-None) fields
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if value is not None:
            current_settings[key] = value

    current_user.security_settings = json.dumps(current_settings)
    db.commit()

    return {
        "message": "Pengaturan keamanan berhasil diperbarui",
        "protected_features": current_settings,
    }
