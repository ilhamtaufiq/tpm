from typing import Optional, List
from pydantic import BaseModel, Field

class SMTPSetting(BaseModel):
    server: str = Field(..., example="smtp.gmail.com")
    port: int = Field(..., example=587)
    username: str = Field(..., example="your-email@gmail.com")
    password: str = Field(..., example="your-app-password")
    use_tls: bool = True
    sender_name: str = Field("TPM System", example="TPM Tiga Putra Motor")

class SettingsUpdate(BaseModel):
    smtp: Optional[SMTPSetting] = None

class SystemSettingResponse(BaseModel):
    smtp: Optional[SMTPSetting] = None
