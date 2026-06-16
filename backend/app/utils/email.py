import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session
from app.models.system_setting import SystemSetting

def get_smtp_config(db: Session) -> Optional[Dict[str, Any]]:
    """Retrieve SMTP configuration from database."""
    smtp_setting = db.query(SystemSetting).filter(SystemSetting.key == "smtp_config").first()
    if smtp_setting and smtp_setting.value:
        try:
            return json.loads(smtp_setting.value)
        except:
            return None
    return None

def send_email(
    db: Session,
    to_email: str,
    subject: str,
    body: str,
    from_name: Optional[str] = None,
    is_html: bool = False
) -> bool:
    """Generic function to send email using stored SMTP configuration."""
    config = get_smtp_config(db)
    if not config:
        return False
    
    try:
        msg = MIMEMultipart()
        sender_name = from_name or config.get("sender_name", "TPM System")
        msg['From'] = f"{sender_name} <{config.get('username')}>"
        msg['To'] = to_email
        msg['Subject'] = subject
        
        msg.attach(MIMEText(body, 'html' if is_html else 'plain'))
        
        # Connect and send
        server = smtplib.SMTP(config.get("server"), config.get("port", 587), timeout=10)
        if config.get("use_tls", True):
            server.starttls()
        
        server.login(config.get("username"), config.get("password"))
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        return False

def send_password_reset_email(db: Session, to_email: str, token: str, user_name: str):
    """Send password reset email to user."""
    from app.config import settings
    
    # Use explicitly configured frontend URL from settings/env
    frontend_url = settings.frontend_url.rstrip('/')
    reset_link = f"{frontend_url}/reset-password?token={token}"
    
    subject = "Reset Password Akun TPM"
    body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #023C69;">Halo {user_name},</h2>
            <p>Kami menerima permintaan untuk mereset password akun TPM Anda.</p>
            <p>Klik tombol di bawah ini untuk mereset password Anda:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{reset_link}" style="background-color: #023C69; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password Sekarang</a>
            </div>
            <p>Jika tombol di atas tidak berfungsi, Anda juga bisa menyalin link berikut ke browser Anda:</p>
            <p style="word-break: break-all; color: #666; font-size: 12px;">{reset_link}</p>
            <p>Link ini akan kadaluarsa dalam 1 jam.</p>
            <p style="color: #999; font-size: 12px;">Jika Anda tidak merasa melakukan permintaan ini, silakan abaikan email ini.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
            <p>Terima kasih,<br><strong>Tim TPM</strong></p>
        </div>
    </body>
    </html>
    """
    
    return send_email(db, to_email, subject, body, is_html=True)
