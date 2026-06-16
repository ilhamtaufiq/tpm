"""add public receipt token to bengkel transactions

Revision ID: 20260604_120000
Revises: 20260603_223000
Create Date: 2026-06-04 12:00:00.000000+07:00

"""
from typing import Sequence, Union
import secrets

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260604_120000"
down_revision: Union[str, None] = "20260603_223000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "transaksi_penjualan_bengkel",
        sa.Column("public_receipt_token", sa.String(length=64), nullable=True),
    )

    connection = op.get_bind()
    rows = connection.execute(
        sa.text(
            "SELECT id FROM transaksi_penjualan_bengkel "
            "WHERE public_receipt_token IS NULL OR public_receipt_token = ''"
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
                "UPDATE transaksi_penjualan_bengkel "
                "SET public_receipt_token = :token WHERE id = :id"
            ),
            {"token": token, "id": row[0]},
        )

    op.alter_column(
        "transaksi_penjualan_bengkel",
        "public_receipt_token",
        existing_type=sa.String(length=64),
        nullable=False,
    )

    op.create_index(
        "ix_transaksi_penjualan_bengkel_public_receipt_token",
        "transaksi_penjualan_bengkel",
        ["public_receipt_token"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_transaksi_penjualan_bengkel_public_receipt_token",
        table_name="transaksi_penjualan_bengkel",
    )
    op.drop_column("transaksi_penjualan_bengkel", "public_receipt_token")
