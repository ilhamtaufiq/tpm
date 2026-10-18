"""
Matriks hak akses per role: fitur unit dibuka hanya untuk role unit yang
bersangkutan (plus MANAGER). Id 999999 tidak ada, jadi role yang lolos
dependency mendapat 404/422, bukan 403.
"""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models.user import LoginOtp, User
from app.utils.constants import UserRole
from app.utils.security import create_access_token, hash_password

ROLES = [UserRole.BENGKEL, UserRole.JASA_ANGKUT, UserRole.MOBIL, UserRole.STAFF, UserRole.MANAGER]

# (method, path, body, role yang diizinkan)
CASES = [
    ("PATCH", "/api/v1/transaksi-bengkel/999999/payment", {}, {UserRole.BENGKEL, UserRole.MANAGER}),
    ("POST", "/api/v1/penjualan-mobil", {}, {UserRole.MOBIL, UserRole.MANAGER}),
    ("PATCH", "/api/v1/penjualan-mobil/999999/payment", {}, {UserRole.MOBIL, UserRole.MANAGER}),
    ("GET", "/api/v1/penjualan-mobil/summary", None, {UserRole.MOBIL, UserRole.MANAGER}),
    ("GET", "/api/v1/mobil/summary", None, {UserRole.MOBIL, UserRole.MANAGER}),
    ("POST", "/api/v1/mobil/999999/biaya", {}, {UserRole.MOBIL, UserRole.MANAGER}),
    ("POST", "/api/v1/mobil/999999/part-service", {}, {UserRole.MOBIL, UserRole.MANAGER}),
    ("PUT", "/api/v1/muatan/999999", {}, {UserRole.JASA_ANGKUT, UserRole.MANAGER}),
    ("POST", "/api/v1/muatan/999999/void", None, {UserRole.JASA_ANGKUT, UserRole.MANAGER}),
    ("GET", "/api/v1/muatan/summary", None, {UserRole.JASA_ANGKUT, UserRole.MANAGER}),
    # Tetap khusus manager/admin
    ("POST", "/api/v1/muatan/999999/biaya", {}, {UserRole.MANAGER}),
    ("DELETE", "/api/v1/muatan/999999", None, {UserRole.MANAGER}),
    ("POST", "/api/v1/penjualan-mobil/999999/cancel-sale", {}, {UserRole.MANAGER}),
    ("DELETE", "/api/v1/transaksi-bengkel/999999", None, {UserRole.MANAGER}),
]


@pytest.fixture(scope="module")
def tokens():
    db = SessionLocal()
    ids, toks = [], {}
    try:
        for role in ROLES:
            tag = uuid.uuid4().hex[:6]
            u = User(username=f"ra{role.value[:3].lower()}{tag}", email=f"ra{tag}@example.com", full_name=role.value,
                     hashed_password=hash_password("Ra#123456"), role=role, is_active=True)
            db.add(u)
            db.commit()
            db.refresh(u)
            ids.append(u.id)
            toks[role] = create_access_token(data={"sub": str(u.id), "username": u.username, "role": role.value,
                                                   "is_impersonation": False, "impersonated_by": None})
        yield toks
    finally:
        db.rollback()
        for uid in ids:
            db.query(LoginOtp).filter(LoginOtp.user_id == uid).delete(synchronize_session=False)
            db.query(User).filter(User.id == uid).delete(synchronize_session=False)
        db.commit()
        db.close()


@pytest.mark.parametrize("method,path,body,allowed", CASES, ids=lambda v: v if isinstance(v, str) else None)
def test_matriks_hak_akses(tokens, method, path, body, allowed):
    c = TestClient(app)
    for role in ROLES:
        kwargs = {"headers": {"Authorization": f"Bearer {tokens[role]}"}}
        if body is not None:
            kwargs["json"] = body
        r = c.request(method, path, **kwargs)
        if role in allowed:
            assert r.status_code != 403, f"{role.value} seharusnya boleh {method} {path}, dapat {r.status_code}"
        else:
            assert r.status_code == 403, f"{role.value} seharusnya ditolak {method} {path}, dapat {r.status_code}"
