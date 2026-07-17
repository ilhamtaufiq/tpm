"""
Reset database: kosongkan semua data transaksi, sisakan hanya user admin.

Usage:
    cd backend
    python reset_db.py

Konfirmasi: ketik RESET
"""
import sys
import os
import pkgutil

# Setup path agar bisa import dari app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import inspect, text
from app.database.connection import engine, SessionLocal
from app.database.base import Base
from app.utils.security import hash_password
from app.utils.constants import UserRole

# Preferensi user yang dipreserv (urutan prioritas)
ADMIN_USERNAME = "admin"
ADMIN_EMAIL = "admin@tpm.com"
ADMIN_PASSWORD = "password123"
ADMIN_FULL_NAME = "Administrator TPM"

# Tabel yang tidak di-TRUNCATE (users dibersihkan terpisah → hanya admin)
PRESERVE_TABLES = {"alembic_version"}


def _load_models():
    """Pastikan model User ter-register sebelum query ORM."""
    import app.models

    for _loader, module_name, _is_pkg in pkgutil.walk_packages(
        app.models.__path__, app.models.__name__ + "."
    ):
        __import__(module_name)
    try:
        Base.registry.configure()
    except Exception:
        pass


def _ensure_single_admin(db) -> None:
    """Hapus semua user non-admin; jamin ada satu user username=admin."""
    from app.models.user import User

    # Prefer username admin; fallback role ADMIN
    admin = (
        db.query(User)
        .filter(User.username == ADMIN_USERNAME)
        .first()
    )
    if not admin:
        admin = (
            db.query(User)
            .filter(User.role == UserRole.ADMIN)
            .order_by(User.id.asc())
            .first()
        )

    if admin:
        # Normalisasi jadi satu admin standar
        admin.username = ADMIN_USERNAME
        admin.email = ADMIN_EMAIL
        admin.full_name = ADMIN_FULL_NAME
        admin.role = UserRole.ADMIN
        admin.is_active = True
        admin.cash_balance = 0
        admin.hashed_pin = None
        admin.security_settings = None
        admin.expo_push_token = None
        admin.reset_token = None
        admin.reset_token_expires = None
        admin.otp_code = None
        admin.otp_expires = None
        admin.last_login = None
        # Password tidak diubah jika admin sudah ada (biar login tetap sama)
        keep_id = admin.id
        deleted = (
            db.query(User)
            .filter(User.id != keep_id)
            .delete(synchronize_session=False)
        )
        print(f"  - Hapus {deleted} user non-admin (sisakan id={keep_id} username={admin.username})")
        print(f"  - Password admin TIDAK diubah (pakai password yang sudah ada).")
    else:
        # Tidak ada admin sama sekali → buat default
        new_admin = User(
            username=ADMIN_USERNAME,
            email=ADMIN_EMAIL,
            hashed_password=hash_password(ADMIN_PASSWORD),
            full_name=ADMIN_FULL_NAME,
            role=UserRole.ADMIN,
            is_active=True,
        )
        db.add(new_admin)
        # Hapus sisa user lain (jika ada non-admin)
        db.flush()
        deleted = (
            db.query(User)
            .filter(User.username != ADMIN_USERNAME)
            .delete(synchronize_session=False)
        )
        print(f"  - Buat user admin baru: {ADMIN_USERNAME} / {ADMIN_PASSWORD}")
        if deleted:
            print(f"  - Hapus {deleted} user lain")


def reset_database():
    print("=" * 60)
    print("!  BAHAYA: RESET DATABASE")
    print("=" * 60)
    print("Script ini akan:")
    print("  1. TRUNCATE semua tabel data (transaksi, master, dll.)")
    print("  2. Menyisakan HANYA user admin (username: admin)")
    print("  3. Mempertahankan tabel sistem alembic_version")
    print("\nPeringatan: Data yang terhapus tidak dapat dikembalikan!")

    confirm = input("\nKetik 'RESET' untuk melanjutkan: ")
    if confirm != "RESET":
        print("Proses dibatalkan.")
        return

    _load_models()
    db = SessionLocal()
    try:
        inspector = inspect(engine)
        table_names = inspector.get_table_names()

        # users diproses terpisah (delete non-admin), bukan truncate
        tables_to_truncate = [
            t for t in table_names if t not in PRESERVE_TABLES and t != "users"
        ]

        print(f"\n[1/2] Mengosongkan {len(tables_to_truncate)} tabel...\n")

        db.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))

        for table in sorted(tables_to_truncate):
            print(f"  TRUNCATE `{table}`")
            db.execute(text(f"TRUNCATE TABLE `{table}`;"))

        print("\n[2/2] Membersihkan users → hanya admin...\n")
        _ensure_single_admin(db)

        db.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
        db.commit()

        # Ringkasan user tersisa
        from app.models.user import User

        remaining = db.query(User).all()
        print("\n" + "=" * 60)
        print("[OK] Reset database berhasil.")
        print(f"User tersisa ({len(remaining)}):")
        for u in remaining:
            print(f"  - id={u.id} username={u.username} role={u.role} email={u.email}")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        try:
            db.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
            db.commit()
        except Exception:
            pass
        print(f"\n[ERROR] Terjadi kesalahan: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    reset_database()
