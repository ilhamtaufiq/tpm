"""
Klasifikasi error SMTP: penyebab gagal kirim harus dibedakan (belum diatur,
login ditolak, koneksi gagal) dan disimpan sebagai status terakhir.
SMTP dipalsukan, jadi test tidak butuh server email sungguhan.
"""
import json
import smtplib
import socket

import pytest

from app.database import SessionLocal
from app.models.system_setting import SystemSetting
from app.utils import email as email_mod

CONFIG = {"server": "smtp.test.local", "port": 587, "username": "bot@test.local",
          "password": "x", "use_tls": True, "sender_name": "TPM Test"}


@pytest.fixture
def db():
    session = SessionLocal()
    # simpan nilai lama, kembalikan setelah test
    saved = {r.key: r.value for r in session.query(SystemSetting).filter(
        SystemSetting.key.in_([email_mod.SMTP_CONFIG_KEY, email_mod.SMTP_STATUS_KEY])).all()}
    yield session
    for key in (email_mod.SMTP_CONFIG_KEY, email_mod.SMTP_STATUS_KEY):
        row = session.query(SystemSetting).filter(SystemSetting.key == key).first()
        if key in saved:
            if row is None:
                row = SystemSetting(key=key, description="test")
                session.add(row)
            row.value = saved[key]
        elif row is not None:
            session.delete(row)
    session.commit()
    session.close()


def _status(db):
    db.rollback()  # baca dari transaksi baru; status ditulis di sesi lain
    return email_mod.get_smtp_status(db)


def _set_config(db, cfg):
    row = db.query(SystemSetting).filter(SystemSetting.key == email_mod.SMTP_CONFIG_KEY).first()
    if row is None:
        row = SystemSetting(key=email_mod.SMTP_CONFIG_KEY, description="test")
        db.add(row)
    row.value = json.dumps(cfg) if cfg is not None else None
    db.commit()


class _FakeSMTP:
    mode = "ok"

    def __init__(self, host, port, timeout=None):
        if _FakeSMTP.mode == "connect":
            raise socket.timeout("timed out")

    def starttls(self):
        pass

    def login(self, user, pw):
        if _FakeSMTP.mode == "auth":
            raise smtplib.SMTPAuthenticationError(535, b"bad credentials")

    def send_message(self, msg):
        pass

    def quit(self):
        pass

    def close(self):
        pass


@pytest.fixture
def fake_smtp(monkeypatch):
    monkeypatch.setattr(email_mod.smtplib, "SMTP", _FakeSMTP)
    _FakeSMTP.mode = "ok"
    yield _FakeSMTP


def test_belum_diatur_menghasilkan_not_configured(db):
    _set_config(db, None)
    hasil = email_mod.send_email_detail(db, "a@b.com", "s", "b")
    assert hasil["ok"] is False and hasil["code"] == email_mod.SMTP_NOT_CONFIGURED
    assert _status(db)["code"] == email_mod.SMTP_NOT_CONFIGURED


def test_login_ditolak_dibedakan_dari_koneksi(db, fake_smtp):
    _set_config(db, CONFIG)
    fake_smtp.mode = "auth"
    hasil = email_mod.send_email_detail(db, "a@b.com", "s", "b")
    assert hasil["code"] == email_mod.SMTP_AUTH_FAILED
    assert "App Password" in hasil["message"]

    fake_smtp.mode = "connect"
    hasil = email_mod.send_email_detail(db, "a@b.com", "s", "b")
    assert hasil["code"] == email_mod.SMTP_CONNECTION_FAILED
    assert "smtp.test.local" in hasil["message"]


def test_kirim_berhasil_dicatat_sebagai_ok(db, fake_smtp):
    _set_config(db, CONFIG)
    hasil = email_mod.send_email_detail(db, "a@b.com", "s", "b")
    assert hasil["ok"] is True and hasil["code"] == email_mod.SMTP_OK
    status = _status(db)
    assert status["ok"] is True and status["checked_at"]


def test_tes_dari_form_tidak_mengubah_status(db, fake_smtp):
    _set_config(db, CONFIG)
    email_mod.send_email_detail(db, "a@b.com", "s", "b")  # status: ok
    fake_smtp.mode = "auth"
    bad = dict(CONFIG, password="salah")
    hasil = email_mod.send_email_detail(db, "a@b.com", "s", "b", config=bad)
    assert hasil["code"] == email_mod.SMTP_AUTH_FAILED
    assert _status(db)["ok"] is True  # tes form tidak menimpa status tersimpan
