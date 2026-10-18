import json
import smtplib
import socket
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session
from app.models.system_setting import SystemSetting

SMTP_CONFIG_KEY = "smtp_config"
SMTP_STATUS_KEY = "smtp_status"

# Kode status SMTP. Dipakai frontend untuk memilih pesan yang tepat.
SMTP_OK = "OK"
SMTP_NOT_CONFIGURED = "NOT_CONFIGURED"
SMTP_AUTH_FAILED = "AUTH_FAILED"
SMTP_CONNECTION_FAILED = "CONNECTION_FAILED"
SMTP_TLS_FAILED = "TLS_FAILED"
SMTP_SEND_FAILED = "SEND_FAILED"


def get_smtp_config(db: Session) -> Optional[Dict[str, Any]]:
    """Retrieve SMTP configuration from database."""
    smtp_setting = db.query(SystemSetting).filter(SystemSetting.key == SMTP_CONFIG_KEY).first()
    if smtp_setting and smtp_setting.value:
        try:
            return json.loads(smtp_setting.value)
        except Exception:
            return None
    return None


def get_smtp_status(db: Session) -> Optional[Dict[str, Any]]:
    """Hasil percobaan kirim email terakhir (None kalau belum pernah dicoba)."""
    row = db.query(SystemSetting).filter(SystemSetting.key == SMTP_STATUS_KEY).first()
    if row and row.value:
        try:
            return json.loads(row.value)
        except Exception:
            return None
    return None


def catat_status(hasil: Dict[str, Any]) -> None:
    """Simpan hasil terakhir di sesi sendiri, supaya tidak ikut transaksi pemanggil."""
    from app.database.connection import SessionLocal

    session = SessionLocal()
    try:
        row = session.query(SystemSetting).filter(SystemSetting.key == SMTP_STATUS_KEY).first()
        if row is None:
            row = SystemSetting(key=SMTP_STATUS_KEY, description="Status pengiriman email terakhir")
            session.add(row)
        row.value = json.dumps({**hasil, "checked_at": datetime.now().isoformat(timespec="seconds")})
        session.commit()
    except Exception as exc:
        session.rollback()
        print(f"[smtp] Gagal menyimpan status SMTP: {exc}")
    finally:
        session.close()


def _klasifikasi_error(exc: Exception, config: Dict[str, Any]) -> Dict[str, str]:
    server = config.get("server", "-")
    port = config.get("port", "-")
    if isinstance(exc, smtplib.SMTPAuthenticationError):
        return {
            "code": SMTP_AUTH_FAILED,
            "message": "Login ke server email ditolak. Periksa username dan App Password SMTP.",
        }
    if isinstance(exc, smtplib.SMTPNotSupportedError):
        return {
            "code": SMTP_TLS_FAILED,
            "message": f"Server {server} port {port} tidak mendukung TLS. Coba port 587 dengan TLS aktif, atau matikan TLS jika server memang mengharuskannya.",
        }
    if isinstance(exc, (smtplib.SMTPConnectError, smtplib.SMTPServerDisconnected, socket.timeout, socket.gaierror, ConnectionError, OSError)):
        return {
            "code": SMTP_CONNECTION_FAILED,
            "message": f"Tidak bisa terhubung ke server {server} port {port}. Periksa alamat server, port, dan koneksi jaringan.",
        }
    if isinstance(exc, smtplib.SMTPRecipientsRefused):
        return {"code": SMTP_SEND_FAILED, "message": "Alamat tujuan ditolak oleh server email."}
    if isinstance(exc, smtplib.SMTPException):
        return {"code": SMTP_SEND_FAILED, "message": f"Server email menolak pengiriman: {exc}"}
    return {"code": SMTP_SEND_FAILED, "message": f"Gagal mengirim email: {exc}"}


def _buka_koneksi(config: Dict[str, Any]) -> smtplib.SMTP:
    server = smtplib.SMTP(config.get("server"), int(config.get("port", 587)), timeout=10)
    try:
        if config.get("use_tls", True):
            server.starttls()
        server.login(config.get("username"), config.get("password"))
    except Exception:
        try:
            server.close()
        except Exception:
            pass
        raise
    return server


def send_email_detail(
    db: Session,
    to_email: str,
    subject: str,
    body: str,
    from_name: Optional[str] = None,
    is_html: bool = False,
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Kirim email dan kembalikan hasil lengkap: ok, code, message.

    `config` dipakai untuk tes dari form yang belum disimpan. Hasil tes seperti
    itu tidak dicatat sebagai status, supaya banner tidak menampilkan konfigurasi
    yang belum berlaku.
    """
    saved = config is None
    if config is None:
        config = get_smtp_config(db)
    if not config:
        hasil = {
            "ok": False,
            "code": SMTP_NOT_CONFIGURED,
            "message": "Server email belum diatur. Admin perlu mengisi konfigurasi SMTP di Pengaturan > Server Email.",
        }
        if saved:
            catat_status(hasil)
        return hasil

    try:
        msg = MIMEMultipart()
        sender_name = from_name or config.get("sender_name", "TPM System")
        msg["From"] = f"{sender_name} <{config.get('username')}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "html" if is_html else "plain"))

        server = _buka_koneksi(config)
        server.send_message(msg)
        server.quit()
        hasil = {"ok": True, "code": SMTP_OK, "message": f"Email berhasil dikirim ke {to_email}."}
    except Exception as exc:
        print(f"[smtp] Gagal mengirim email: {exc}")
        hasil = {"ok": False, **_klasifikasi_error(exc, config)}

    if saved:
        catat_status(hasil)
    return hasil


def send_email(
    db: Session,
    to_email: str,
    subject: str,
    body: str,
    from_name: Optional[str] = None,
    is_html: bool = False
) -> bool:
    """Generic function to send email using stored SMTP configuration."""
    return send_email_detail(db, to_email, subject, body, from_name=from_name, is_html=is_html)["ok"]


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
