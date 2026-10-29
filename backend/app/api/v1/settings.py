import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import APIRouter, HTTPException, status
from app.api.deps import DBSession, CurrentUser
from app.models.system_setting import SystemSetting
from app.schemas.settings import SystemSettingResponse, SettingsUpdate, SMTPSetting
from app.utils.email import catat_status, get_smtp_config, get_smtp_status, send_email_detail

router = APIRouter(prefix="/settings", tags=["System Settings"])

@router.get("", response_model=SystemSettingResponse)
def get_settings(db: DBSession, current_user: CurrentUser):
    from app.utils.constants import UserRole

    """Retrieve global system settings."""
    # Check if user is admin (optional, depending on requirements)
    from app.utils.constants import UserRole
    if current_user.role != UserRole.ADMIN:
        # For now let's allow read, but we might want to restrict this
        pass
        
    # Retrieve from DB with safety
    try:
        smtp_setting = db.query(SystemSetting).filter(SystemSetting.key == "smtp_config").first()
        print_setting = db.query(SystemSetting).filter(SystemSetting.key == "print_config").first()
        theme_setting = db.query(SystemSetting).filter(SystemSetting.key == "theme_config").first()
    except:
        smtp_setting = None
        print_setting = None
        theme_setting = None

    # Default values
    resp = {
        "smtp": None,
        "theme": None,
        "print": {
            "company_name": "Tiga Putra Motor",
            "company_address": "Cianjur, Jawa Barat",
            "company_phone": "+62 856 5999 4407",
            "header": "TPM SUPER APP",
            "footer": "Terima kasih telah menggunakan layanan kami",
            "logo_uri": "tpm_default",
            "show_qr_code": True,
            "paper_size": "80mm",
            "print_method": "browser"
        }
    }
    
    # Merge DB values if available
    if smtp_setting and smtp_setting.value:
        try:
            val = json.loads(smtp_setting.value)
            # Konfigurasi SMTP berisi password: hanya admin yang boleh membacanya.
            if isinstance(val, dict) and current_user.role == UserRole.ADMIN:
                resp["smtp"] = val
        except:
            pass
            
    if print_setting and print_setting.value:
        try:
            val = json.loads(print_setting.value)
            if isinstance(val, dict):
                # Merge DB config into defaults to preserve missing keys
                resp["print"].update(val)
        except:
            pass
        
    if theme_setting and theme_setting.value:
        try:
            val = json.loads(theme_setting.value)
            if isinstance(val, dict):
                resp["theme"] = val
        except:
            pass

    return resp

@router.put("")
def update_settings(data: SettingsUpdate, db: DBSession, current_user: CurrentUser):
    """Update global system settings."""
    from app.utils.constants import UserRole
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hanya Administrator yang dapat mengubah pengaturan sistem"
        )

    if data.smtp:
        smtp_setting = db.query(SystemSetting).filter(SystemSetting.key == "smtp_config").first()
        if not smtp_setting:
            smtp_setting = SystemSetting(key="smtp_config", description="SMTP Configuration for sending emails")
            db.add(smtp_setting)
        
        smtp_setting.value = json.dumps(data.smtp.model_dump())
        
    if data.print:
        print_setting = db.query(SystemSetting).filter(SystemSetting.key == "print_config").first()
        if not print_setting:
            print_setting = SystemSetting(key="print_config", description="Printing and Branding Configuration")
            db.add(print_setting)
        
        print_setting.value = json.dumps(data.print.model_dump())
        
    if data.theme:
        theme_setting = db.query(SystemSetting).filter(SystemSetting.key == "theme_config").first()
        if not theme_setting:
            theme_setting = SystemSetting(key="theme_config", description="Warna tema perusahaan")
            db.add(theme_setting)

        theme_setting.value = json.dumps(data.theme.model_dump())

    db.commit()
    return {"message": "Pengaturan berhasil diperbarui"}

@router.get("/smtp-status")
def get_smtp_status_endpoint(db: DBSession, current_user: CurrentUser):
    """Hasil pengiriman email terakhir, untuk banner di halaman SMTP (admin)."""
    from app.utils.constants import UserRole
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Hanya Administrator yang dapat melihat status SMTP")
    return get_smtp_status(db) or {"ok": None, "code": None, "message": None, "checked_at": None}


@router.post("/test-smtp")
def test_smtp(config: SMTPSetting, db: DBSession, current_user: CurrentUser):
    """Kirim email percobaan ke admin yang login, memakai konfigurasi dari form."""
    from app.utils.constants import UserRole
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Hanya Administrator yang dapat menguji SMTP")

    hasil = send_email_detail(
        db,
        current_user.email,
        "Test Koneksi SMTP TPM",
        f"Halo {current_user.full_name}!\n\nIni adalah email percobaan untuk memverifikasi pengaturan SMTP Anda di sistem TPM.\nJika Anda menerima email ini, berarti konfigurasi SMTP sudah benar.",
        from_name=config.sender_name,
        config=config.model_dump(),
    )
    # Tes atas konfigurasi yang sudah tersimpan dicatat sebagai status (banner di halaman SMTP).
    if get_smtp_config(db) == config.model_dump():
        catat_status(hasil)
    return {"success": hasil["ok"], "code": hasil["code"], "message": hasil["message"]}
