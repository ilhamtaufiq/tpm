"""One-off fix for hutang_usaha.sumber enum (refund DP booking)."""
from app.database import SessionLocal
from app.utils.db_schema import ensure_hutang_sumber_enum


def main() -> None:
    db = SessionLocal()
    try:
        ensure_hutang_sumber_enum(db)
        print("hutang_usaha.sumber enum OK (UANG_MUKA_PENJUALAN available)")
    except Exception as exc:
        print(f"Error: {exc}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    main()