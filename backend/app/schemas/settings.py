from typing import Optional, List
from pydantic import BaseModel, Field

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

class SettingsUpdate(BaseModel):
    smtp: Optional[SMTPSetting] = None
    print: Optional[PrintSetting] = None

class SystemSettingResponse(BaseModel):
    smtp: Optional[dict] = None
    print: Optional[dict] = None
