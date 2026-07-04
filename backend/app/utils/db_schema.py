from sqlalchemy import text
from sqlalchemy.orm import Session


HUTANG_SUMBER_ENUM_SQL = (
    "ENUM('PEMBELIAN_PART', 'PEMBELIAN_MOBIL', 'JUAL_BELI_MOBIL', "
    "'UANG_MUKA_PENJUALAN', 'LAINNYA')"
)


def ensure_hutang_sumber_enum(db: Session) -> None:
    """Ensure hutang_usaha.sumber supports refund DP booking liabilities."""
    column_type = db.execute(
        text(
            "SELECT COLUMN_TYPE FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() "
            "AND TABLE_NAME = 'hutang_usaha' AND COLUMN_NAME = 'sumber'"
        )
    ).scalar()

    if not column_type or "UANG_MUKA_PENJUALAN" in str(column_type).upper():
        return

    db.execute(
        text(
            "ALTER TABLE hutang_usaha MODIFY COLUMN sumber "
            f"{HUTANG_SUMBER_ENUM_SQL} NOT NULL DEFAULT 'PEMBELIAN_PART'"
        )
    )
    db.commit()