"""
Hapus user: nonaktifkan (default), hapus permanen hanya bila user tidak punya
catatan apa pun, dan admin aktif terakhir tidak bisa dinonaktifkan.
"""
import uuid
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.database import SessionLocal
from app.models.keuangan import KasBank
from app.models.user import LoginOtp, User
from app.services.auth_service import AuthService
from app.services.kas_bank_integration import create_kas_entry
from app.utils.constants import KasBankJenis, KasBankSource, KasBankType, PaymentMethod, UserRole
from app.utils.security import hash_password


def _buat_user(db, role=UserRole.STAFF, password="Pass#12345"):
    tag = uuid.uuid4().hex[:8]
    u = User(username=f"del{tag}", email=f"del{tag}@example.com", full_name="Del Test",
             hashed_password=hash_password(password), role=role, is_active=True)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _hapus_sisa(db, user_ids):
    db.rollback()
    for uid in user_ids:
        db.query(LoginOtp).filter(LoginOtp.user_id == uid).delete(synchronize_session=False)
        db.query(User).filter(User.id == uid).delete(synchronize_session=False)
    db.commit()


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.rollback()
    session.close()


def test_hapus_permanen_user_tanpa_catatan(db):
    u = _buat_user(db)
    uid = u.id
    svc = AuthService(db)
    assert svc.cek_hapus_user(uid)["bisa_hapus_permanen"] is True

    svc.delete_user(uid, permanent=True)
    db.expire_all()
    assert db.get(User, uid) is None


def test_hapus_permanen_ditolak_bila_ada_transaksi_dan_user_tetap_ada(db):
    u = _buat_user(db)
    uid = u.id
    try:
        # Kas yang dicatat oleh user ini (created_by) menjadi catatan yang mengikatnya.
        create_kas_entry(
            db=db, tanggal=__import__("datetime").date(2026, 10, 1), tipe=KasBankType.MASUK,
            nominal=Decimal("1000"), sumber=KasBankSource.LAINNYA, metode_bayar=PaymentMethod.TUNAI,
            referensi_id=None, nomor_referensi=f"TST-DEL-{uid}", keterangan="test hapus user",
            user_id=uid, kas_jenis=KasBankJenis.KAS_UTAMA, allow_negative=True, commit=True,
        )
        svc = AuthService(db)
        cek = svc.cek_hapus_user(uid)
        assert cek["bisa_hapus_permanen"] is False and cek["total_referensi"] >= 1

        with pytest.raises(HTTPException) as err:
            svc.delete_user(uid, permanent=True)
        assert err.value.status_code == 409
        db.expire_all()
        assert db.get(User, uid) is not None
    finally:
        db.rollback()
        db.query(KasBank).filter(KasBank.nomor_referensi == f"TST-DEL-{uid}").delete(synchronize_session=False)
        db.commit()
        _hapus_sisa(db, [uid])


def test_nonaktifkan_menahan_login(db):
    u = _buat_user(db, password="Pass#12345")
    uid, username = u.id, u.username
    try:
        AuthService(db).delete_user(uid)  # default: nonaktifkan
        db.expire_all()
        assert db.get(User, uid).is_active is False
        with pytest.raises(HTTPException) as err:
            AuthService(db).authenticate(username, "Pass#12345")
        assert err.value.status_code == 401
        assert "inactive" in err.value.detail
    finally:
        _hapus_sisa(db, [uid])


def test_admin_aktif_terakhir_tidak_bisa_dinonaktifkan(db):
    # Simpan admin aktif lain, nonaktifkan sementara, lalu kembalikan.
    lain = db.query(User).filter(User.role == UserRole.ADMIN, User.is_active.is_(True)).all()
    lain_ids = [a.id for a in lain]
    admin = _buat_user(db, role=UserRole.ADMIN)
    uid = admin.id
    try:
        for a in lain:
            a.is_active = False
        db.commit()
        with pytest.raises(HTTPException) as err:
            AuthService(db).delete_user(uid)
        assert err.value.status_code == 400
        db.expire_all()
        assert db.get(User, uid).is_active is True
    finally:
        db.rollback()
        for a in db.query(User).filter(User.id.in_(lain_ids)).all():
            a.is_active = True
        db.commit()
        _hapus_sisa(db, [uid])
