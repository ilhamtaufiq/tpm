"""add public tokens to mobil and mobil sale receipts

Revision ID: 20260604_130000
Revises: 20260604_120000
Create Date: 2026-06-04 13:00:00.000000+07:00

"""
from typing import Sequence, Union
import secrets

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260604_130000"
down_revision: Union[str, None] = "20260604_120000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _backfill_tokens(table_name: str, column_name: str) -> None:
    connection = op.get_bind()
    rows = connection.execute(
        sa.text(
            f"SELECT id FROM {table_name} "
            f"WHERE {column_name} IS NULL OR {column_name} = ''"
        )
    ).fetchall()

    used_tokens = set()
    for row in rows:
        token = secrets.token_urlsafe(32)
        while token in used_tokens:
            token = secrets.token_urlsafe(32)
        used_tokens.add(token)
        connection.execute(
            sa.text(
                f"UPDATE {table_name} SET {column_name} = :token WHERE id = :id"
            ),
            {"token": token, "id": row[0]},
        )


def upgrade() -> None:
    op.add_column(
        "mobil",
        sa.Column("public_gallery_token", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "transaksi_penjualan_mobil",
        sa.Column("public_receipt_token", sa.String(length=64), nullable=True),
    )

    _backfill_tokens("mobil", "public_gallery_token")
    _backfill_tokens("transaksi_penjualan_mobil", "public_receipt_token")

    op.alter_column(
        "mobil",
        "public_gallery_token",
        existing_type=sa.String(length=64),
        nullable=False,
    )
    op.alter_column(
        "transaksi_penjualan_mobil",
        "public_receipt_token",
        existing_type=sa.String(length=64),
        nullable=False,
    )

    op.create_index(
        "ix_mobil_public_gallery_token",
        "mobil",
        ["public_gallery_token"],
        unique=True,
    )
    op.create_index(
        "ix_transaksi_penjualan_mobil_public_receipt_token",
        "transaksi_penjualan_mobil",
        ["public_receipt_token"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_transaksi_penjualan_mobil_public_receipt_token",
        table_name="transaksi_penjualan_mobil",
    )
    op.drop_index("ix_mobil_public_gallery_token", table_name="mobil")
    op.drop_column("transaksi_penjualan_mobil", "public_receipt_token")
    op.drop_column("mobil", "public_gallery_token")
