"""GET /settings hanya boleh mengembalikan konfigurasi SMTP (berisi password) ke admin."""
import json
import uuid

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models.system_setting import SystemSetting
from app.models.user import LoginOtp, User
from app.utils.constants import UserRole
from app.utils.email import SMTP_CONFIG_KEY
from app.utils.security import create_access_token, hash_password

SECRET = "RAHASIA-TEST-SMTP-987"


def _token(db, role):
    tag = uuid.uuid4().hex[:6]
    u = User(username=f"sa{tag}", email=f"sa{tag}@example.com", full_name="SA", hashed_password=hash_password("Sa#123456"),
             role=role, is_active=True)
    db.add(u)
    db.commit()
    db.refresh(u)
    tok = create_access_token(data={"sub": str(u.id), "username": u.username, "role": role.value,
                                    "is_impersonation": False, "impersonated_by": None})
    return u.id, tok


def test_smtp_password_hanya_terlihat_untuk_admin():
    db = SessionLocal()
    row = db.query(SystemSetting).filter(SystemSetting.key == SMTP_CONFIG_KEY).first()
    old = row.value if row else None
    if row is None:
        row = SystemSetting(key=SMTP_CONFIG_KEY, description="test")
        db.add(row)
    row.value = json.dumps({"server": "smtp.test", "port": 587, "username": "bot@test", "password": SECRET,
                            "use_tls": True, "sender_name": "T"})
    db.commit()
    ids = []
    try:
        c = TestClient(app)
        for role in (UserRole.BENGKEL, UserRole.JASA_ANGKUT, UserRole.MOBIL, UserRole.KASIR):
            uid, tok = _token(db, role)
            ids.append(uid)
            r = c.get("/api/v1/settings", headers={"Authorization": f"Bearer {tok}"})
            assert r.status_code == 200
            assert SECRET not in r.text, f"password SMTP bocor ke role {role.value}"
        uid, tok = _token(db, UserRole.ADMIN)
        ids.append(uid)
        r = c.get("/api/v1/settings", headers={"Authorization": f"Bearer {tok}"})
        assert r.json()["smtp"]["password"] == SECRET
    finally:
        db.rollback()
        for uid in ids:
            db.query(LoginOtp).filter(LoginOtp.user_id == uid).delete(synchronize_session=False)
            db.query(User).filter(User.id == uid).delete(synchronize_session=False)
        row = db.query(SystemSetting).filter(SystemSetting.key == SMTP_CONFIG_KEY).first()
        if old is None:
            if row is not None:
                db.delete(row)
        else:
            row.value = old
        db.commit()
        db.close()
