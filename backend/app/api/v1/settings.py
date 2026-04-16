import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import APIRouter, HTTPException, status
from app.api.deps import DBSession, CurrentUser
from app.models.system_setting import SystemSetting
from app.schemas.settings import SystemSettingResponse, SettingsUpdate, SMTPSetting

router = APIRouter(prefix="/settings", tags=["System Settings"])

@router.get("", response_model=SystemSettingResponse)
def get_settings(db: DBSession, current_user: CurrentUser):
    """Retrieve global system settings."""
    # Check if user is admin (optional, depending on requirements)
    from app.utils.constants import UserRole
    if current_user.role != UserRole.ADMIN:
        # For now let's allow read, but we might want to restrict this
        pass
        
    print_setting = db.query(SystemSetting).filter(SystemSetting.key == "print_config").first()
    
    resp = {
        "smtp": None,
        "print": None
    }
    
    if smtp_setting and smtp_setting.value:
        try:
            resp["smtp"] = json.loads(smtp_setting.value)
        except:
            pass
            
    if print_setting and print_setting.value:
        try:
            resp["print"] = json.loads(print_setting.value)
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
        
    db.commit()
    return {"message": "Pengaturan berhasil diperbarui"}

@router.post("/test-smtp")
def test_smtp(config: SMTPSetting, current_user: CurrentUser):
    """Send a test email to verify SMTP configuration."""
    try:
        msg = MIMEMultipart()
        msg['From'] = f"{config.sender_name} <{config.username}>"
        msg['To'] = current_user.email
        msg['Subject'] = "Test Koneksi SMTP TPM"
        
        body = f"Halo {current_user.full_name}!\n\nIni adalah email percobaan untuk memverifikasi pengaturan SMTP Anda di sistem TPM.\nJika Anda menerima email ini, berarti konfigurasi SMTP sudah benar."
        msg.attach(MIMEText(body, 'plain'))
        
        # Connect and send
        try:
            server = smtplib.SMTP(config.server, config.port, timeout=10)
            if config.use_tls:
                server.starttls()
            
            server.login(config.username, config.password)
            server.send_message(msg)
            server.quit()
        except smtplib.SMTPAuthenticationError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Gagal Autentikasi: Username atau Password/App Password salah."
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Koneksi Error: {str(e)}"
            )
        
        return {"success": True, "message": f"Email percobaan berhasil dikirim ke {current_user.email}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memproses pengiriman email: {str(e)}"
        )
