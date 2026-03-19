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
    # Build your reset URL here. In a real app, this should point to your frontend.
    # We can try to get the base URL from settings if available, or use a default.
    from app.config import settings
    
    # Simple heuristic to get the frontend URL
    # Usually it's the first origin in cors_origins_list that isn't localhost:8000
    frontend_url = "https://tpm.cianjur.space" # Default fallback
    for origin in settings.cors_origins_list:
        if "localhost" in origin and "8000" not in origin:
            frontend_url = origin
            break
        elif "localhost" not in origin:
            frontend_url = origin
            break
            
    reset_link = f"{frontend_url}/reset-password?token={token}"
    
    subject = "Reset Password Akun TPM"
    body = f"""
    <html>
    <body>
        <h2>Halo {user_name},</h2>
        <p>Kami menerima permintaan untuk mereset password akun TPM Anda.</p>
        <p>Klik tombol di bawah ini untuk mereset password Anda:</p>
        <p>
            <a href="{reset_link}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
        </p>
        <p>Link ini akan kadaluarsa dalam 1 jam.</p>
        <p>Jika Anda tidak merasa melakukan permintaan ini, silakan abaikan email ini.</p>
        <br>
        <p>Terima kasih,<br>Tim TPM</p>
    </body>
    </html>
    """
    
    return send_email(db, to_email, subject, body, is_html=True)
