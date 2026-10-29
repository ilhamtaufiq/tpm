from typing import Optional, List
from pydantic import BaseModel, Field, field_validator
import re

class SMTPSetting(BaseModel):
    server: str = Field(..., example="smtp.gmail.com")
    port: int = Field(..., example=587)
    username: str = Field(..., example="your-email@gmail.com")
    password: str = Field(..., example="your-app-password")
    use_tls: bool = True
    sender_name: str = Field("TPM System", example="TPM Tiga Putra Motor")

class PrintSetting(BaseModel):
    company_name: str = Field(..., max_length=100)
    company_address: str = Field(..., max_length=255)
    company_phone: str = Field(..., max_length=50)
    header: Optional[str] = None
    footer: Optional[str] = None
    logo_uri: Optional[str] = None  # Base64 logo
    show_qr_code: bool = True
    paper_size: str = "80mm"
    print_method: str = "browser"

class ThemeSetting(BaseModel):
    """Warna tema perusahaan (berlaku untuk semua pengguna)."""

    primary: str
    secondary: str
    background: str
    surface: str
    text: str
    textGray: str

    @field_validator("primary", "secondary", "background", "surface", "text", "textGray")
    @classmethod
    def hex_valid(cls, v: str) -> str:
        if not re.fullmatch(r"#[0-9A-Fa-f]{6}", v):
            raise ValueError("Warna harus format hex #RRGGBB")
        return v.upper()

class SettingsUpdate(BaseModel):
    smtp: Optional[SMTPSetting] = None
    print: Optional[PrintSetting] = None
    theme: Optional[ThemeSetting] = None

class SystemSettingResponse(BaseModel):
    smtp: Optional[dict] = None
    print: Optional[dict] = None
    theme: Optional[dict] = None
