"""Regresi alur OTP login.

Menutupi bug yang ditemukan saat analisa 2FA:
- `random.randint` untuk kode autentikasi (harus `secrets`);
- OTP gagal kirim tapi response tetap `otp_required=True` → user mentok;
- `verify_otp` tanpa batas percobaan → 6 digit bisa di-brute-force;
- satu `users.otp_code` per user → dua login bersamaan saling menimpa;
- kode disimpan plaintext;
- `/auth/login` tanpa rate limit.

Jalankan: `python tests/test_login_otp.py` (butuh MySQL `tpm_db` hidup).
User uji dibuat lalu dihapus di akhir; tidak menyentuh data lain.
"""
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException

from app.database import SessionLocal
from app.models.user import LoginOtp, User
from app.services import auth_service as auth_mod
from app.services.auth_service import AuthService, OTP_MAX_ATTEMPTS
from app.utils import rate_limit
from app.utils.constants import HIDDEN_USERNAMES, UserRole
from app.utils.security import hash_otp, hash_password, verify_otp_hash

TEST_USERNAME = "__otp_regression__"
TEST_EMAIL = "otp-regression@example.invalid"
CODE_RE = re.compile(r">(\d{6})<")


class _StubEmail:
    """Ganti `app.utils.email.send_email`; tanpa SMTP nyata."""

    def __init__(self, ok: bool = True):
        self.ok = ok
        self.calls = []

    def __call__(self, db, to_email, subject, body, from_name=None, is_html=False):
        self.calls.append({"to": to_email, "subject": subject, "body": body})
        return self.ok

    def code(self, index: int = -1) -> str:
        """Ambil kode OTP dari isi email terakhir."""
        match = CODE_RE.search(self.calls[index]["body"])
        assert match, "kode OTP tidak ada di isi email"
        return match.group(1)


def _make_user(db, role: UserRole = UserRole.STAFF) -> User:
    db.query(User).filter(User.username == TEST_USERNAME).delete()
    db.commit()
    user = User(
        username=TEST_USERNAME,
        email=TEST_EMAIL,
        full_name="OTP Regression",
        hashed_password=hash_password("secret123"),
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _pending(db, user_id: int):
    return db.query(LoginOtp).filter(LoginOtp.user_id == user_id).all()


def _with_stub(stub, fn):
    import app.utils.email as email_mod
    original = email_mod.send_email
    email_mod.send_email = stub
    try:
        return fn()
    finally:
        email_mod.send_email = original


def _cleanup(db):
    db.query(User).filter(User.username == TEST_USERNAME).delete()
    db.commit()
    db.close()


def test_otp_dikirim_ke_email_user_sendiri():
    db = SessionLocal()
    stub = _StubEmail()
    try:
        def run():
            user = _make_user(db)
            resp = AuthService(db).authenticate(TEST_USERNAME, "secret123")
            assert resp.otp_required is True
            assert resp.email == TEST_EMAIL, "OTP harus ke email akun itu sendiri"
            assert len(stub.calls) == 1 and stub.calls[0]["to"] == TEST_EMAIL

            rows = _pending(db, user.id)
            assert len(rows) == 1
            assert rows[0].attempts == 0
            assert rows[0].expires_at > datetime.now()
        _with_stub(stub, run)
    finally:
        _cleanup(db)


def test_kode_tidak_disimpan_plaintext():
    db = SessionLocal()
    stub = _StubEmail()
    try:
        def run():
            user = _make_user(db)
            AuthService(db).authenticate(TEST_USERNAME, "secret123")
            kode = stub.code()

            rows = _pending(db, user.id)
            assert rows[0].otp_hash != kode, "kode mentah tidak boleh tersimpan"
            assert len(rows[0].otp_hash) == 64
            assert verify_otp_hash(kode, rows[0].otp_hash)
            assert not verify_otp_hash("000000", rows[0].otp_hash) or kode == "000000"
        _with_stub(stub, run)
    finally:
        _cleanup(db)


def test_gagal_kirim_email_tidak_menipu_client():
    """Non-admin: 503, bukan `otp_required=True` untuk kode yang tak pernah tiba."""
    db = SessionLocal()
    stub = _StubEmail(ok=False)
    try:
        def run():
            user = _make_user(db)
            try:
                AuthService(db).authenticate(TEST_USERNAME, "secret123")
                raise AssertionError("harus raise 503 saat email gagal terkirim")
            except HTTPException as e:
                assert e.status_code == 503, e.status_code
            assert _pending(db, user.id) == [], "OTP harus dibatalkan kalau email gagal"
        _with_stub(stub, run)
    finally:
        _cleanup(db)


def test_admin_tidak_perlu_otp():
    """Admin langsung masuk — SMTP mati tidak boleh mengunci sistem."""
    db = SessionLocal()
    stub = _StubEmail()
    try:
        def run():
            user = _make_user(db, role=UserRole.ADMIN)
            resp = AuthService(db).authenticate(TEST_USERNAME, "secret123")
            assert resp.otp_required is False
            assert resp.access_token, "admin harus langsung dapat token"
            assert resp.user.username == TEST_USERNAME
            assert stub.calls == [], "admin tidak boleh dikirimi OTP"
            assert _pending(db, user.id) == []
        _with_stub(stub, run)
    finally:
        _cleanup(db)


def test_akun_stealth_tidak_perlu_otp():
    """Akun stealth bisa punya email fiktif — OTP hanya akan menguncinya.

    HIDDEN_USERNAMES di-patch, bukan memakai `god` sungguhan: test tidak boleh
    menyentuh akun produksi.
    """
    db = SessionLocal()
    stub = _StubEmail()
    original_hidden = auth_mod.HIDDEN_USERNAMES
    auth_mod.HIDDEN_USERNAMES = frozenset({TEST_USERNAME})
    try:
        def run():
            _make_user(db, role=UserRole.STAFF)
            resp = AuthService(db).authenticate(TEST_USERNAME, "secret123")
            assert resp.otp_required is False, "akun stealth tidak boleh kena OTP"
            assert resp.access_token
            assert stub.calls == []
        _with_stub(stub, run)
    finally:
        auth_mod.HIDDEN_USERNAMES = original_hidden
        _cleanup(db)


def test_verify_otp_benar_menerbitkan_token():
    db = SessionLocal()
    stub = _StubEmail()
    try:
        def run():
            user = _make_user(db)
            service = AuthService(db)
            service.authenticate(TEST_USERNAME, "secret123")
            resp = service.verify_otp(user.id, stub.code())
            assert resp.access_token and resp.user.username == TEST_USERNAME
            assert _pending(db, user.id) == [], "kode terpakai harus dihapus"
        _with_stub(stub, run)
    finally:
        _cleanup(db)


def test_dua_login_bersamaan_tidak_saling_menimpa():
    """Tiap login dapat kodenya sendiri; sukses di satu sesi tidak merusak sesi lain."""
    db = SessionLocal()
    stub = _StubEmail()
    try:
        def run():
            user = _make_user(db)
            service = AuthService(db)
            service.authenticate(TEST_USERNAME, "secret123")
            service.authenticate(TEST_USERNAME, "secret123")

            kode_a, kode_b = stub.code(0), stub.code(1)
            assert len(_pending(db, user.id)) == 2, "kedua kode harus hidup berdampingan"

            # Login pertama memakai kodenya → token.
            assert service.verify_otp(user.id, kode_a).access_token
            # Sesi kedua masih bisa lanjut dengan kodenya sendiri.
            assert service.verify_otp(user.id, kode_b).access_token
        _with_stub(stub, run)
    finally:
        _cleanup(db)


def test_brute_force_dibatasi():
    db = SessionLocal()
    stub = _StubEmail()
    try:
        def run():
            user = _make_user(db)
            service = AuthService(db)
            service.authenticate(TEST_USERNAME, "secret123")
            kode = stub.code()
            salah = "000000" if kode != "000000" else "111111"

            for _ in range(OTP_MAX_ATTEMPTS - 1):
                try:
                    service.verify_otp(user.id, salah)
                    raise AssertionError("kode salah seharusnya ditolak")
                except HTTPException as e:
                    assert e.status_code == 400, e.status_code

            # Percobaan yang melewati batas mengunci kodenya.
            try:
                service.verify_otp(user.id, salah)
                raise AssertionError("harus 429 setelah batas percobaan")
            except HTTPException as e:
                assert e.status_code == 429, e.status_code
            assert _pending(db, user.id) == [], "kode terkunci harus dihapus"

            # Kode yang benar pun sudah tidak berlaku.
            try:
                service.verify_otp(user.id, kode)
                raise AssertionError("kode seharusnya sudah dikunci")
            except HTTPException as e:
                assert e.status_code == 400, e.status_code
        _with_stub(stub, run)
    finally:
        _cleanup(db)


def test_otp_kadaluarsa_ditolak_dan_dibersihkan():
    db = SessionLocal()
    stub = _StubEmail()
    try:
        def run():
            user = _make_user(db)
            service = AuthService(db)
            service.authenticate(TEST_USERNAME, "secret123")
            kode = stub.code()

            row = _pending(db, user.id)[0]
            row.expires_at = datetime.now() - timedelta(seconds=1)
            db.commit()

            try:
                service.verify_otp(user.id, kode)
                raise AssertionError("OTP kadaluarsa seharusnya ditolak")
            except HTTPException as e:
                assert "kadaluarsa" in e.detail
            assert _pending(db, user.id) == [], "kode kadaluarsa harus dibersihkan"
        _with_stub(stub, run)
    finally:
        _cleanup(db)


def test_resend_menerbitkan_kode_baru_dengan_attempts_bersih():
    db = SessionLocal()
    stub = _StubEmail()
    try:
        def run():
            user = _make_user(db)
            service = AuthService(db)
            service.authenticate(TEST_USERNAME, "secret123")

            # Sesi yang macet sudah salah 3x.
            _pending(db, user.id)[0].attempts = 3
            db.commit()

            service.resend_otp(user.id)
            assert len(stub.calls) == 2, "resend harus mengirim email lagi"

            kode_lama = stub.code(0)
            kode_baru = stub.code(1)
            rows = {r.otp_hash: r for r in _pending(db, user.id)}
            baru = rows[hash_otp(kode_baru)]
            assert baru.attempts == 0, "kode baru mulai dari nol percobaan"
            assert baru.expires_at > datetime.now()

            # Sesi lama tidak ikut mati — login bersamaan tetap jalan.
            assert hash_otp(kode_lama) in rows
            assert service.verify_otp(user.id, kode_baru).access_token
            assert service.verify_otp(user.id, kode_lama).access_token
        _with_stub(stub, run)
    finally:
        _cleanup(db)


def test_resend_user_tidak_dikenal_tidak_membocorkan():
    db = SessionLocal()
    stub = _StubEmail()
    try:
        def run():
            try:
                AuthService(db).resend_otp(999_999_999)
                raise AssertionError("harus menolak user_id tidak dikenal")
            except HTTPException as e:
                assert e.status_code == 400
        _with_stub(stub, run)
    finally:
        db.close()


def test_rate_limit_mengunci_setelah_batas():
    """`/auth/login` dan `/auth/resend-otp` dibatasi per IP."""
    class _Req:
        headers = {"x-forwarded-for": "203.0.113.7, 10.0.0.1"}
        client = None

    rate_limit.reset()
    try:
        for _ in range(3):
            rate_limit.check(_Req(), "unit-test", limit=3, window_seconds=60)
        try:
            rate_limit.check(_Req(), "unit-test", limit=3, window_seconds=60)
            raise AssertionError("harus 429 setelah melewati batas")
        except HTTPException as e:
            assert e.status_code == 429
            assert e.headers.get("Retry-After")

        # Scope lain tidak terpengaruh.
        rate_limit.check(_Req(), "unit-test-lain", limit=1, window_seconds=60)
    finally:
        rate_limit.reset()


def test_rate_limit_menghitung_per_ip():
    class _Req:
        def __init__(self, ip):
            self.headers = {"x-forwarded-for": ip}
            self.client = None

    rate_limit.reset()
    try:
        rate_limit.check(_Req("198.51.100.1"), "per-ip", limit=1, window_seconds=60)
        # IP berbeda punya jatah sendiri — satu kantor di balik NAT tidak
        # memblokir karyawan lain.
        rate_limit.check(_Req("198.51.100.2"), "per-ip", limit=1, window_seconds=60)
    finally:
        rate_limit.reset()


def test_hash_otp_stabil_dan_tidak_reversibel():
    """Lookup verifikasi mengandalkan hash yang deterministik."""
    assert hash_otp("123456") == hash_otp("123456")
    assert hash_otp("123456") != hash_otp("123457")
    assert hash_otp("123456") != "123456"
    assert len(hash_otp("123456")) == 64


def test_tabel_login_otps_ikut_terhapus_bersama_user():
    """FK ON DELETE CASCADE — reset user tidak meninggalkan kode menggantung."""
    db = SessionLocal()
    stub = _StubEmail()
    try:
        def run():
            user = _make_user(db)
            AuthService(db).authenticate(TEST_USERNAME, "secret123")
            user_id = user.id
            assert _pending(db, user_id)

            db.query(User).filter(User.id == user_id).delete()
            db.commit()
            assert _pending(db, user_id) == []
        _with_stub(stub, run)
    finally:
        _cleanup(db)


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print(f"ok  {t.__name__}")
    print(f"\n{len(tests)} lulus")
