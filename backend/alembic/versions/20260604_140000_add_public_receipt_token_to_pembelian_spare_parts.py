"""add public receipt token to spare part purchases

Revision ID: 20260604_140000
Revises: 20260604_130000
Create Date: 2026-06-04 14:00:00.000000+07:00

"""
from typing import Sequence, Union
import secrets

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260604_140000"
down_revision: Union[str, None] = "20260604_130000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "pembelian_spare_parts",
        sa.Column("public_receipt_token", sa.String(length=64), nullable=True),
    )

    connection = op.get_bind()
    rows = connection.execute(
        sa.text(
            "SELECT id FROM pembelian_spare_parts "
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
                "UPDATE pembelian_spare_parts "
                "SET public_receipt_token = :token WHERE id = :id"
            ),
            {"token": token, "id": row[0]},
        )

    op.alter_column(
        "pembelian_spare_parts",
        "public_receipt_token",
        existing_type=sa.String(length=64),
        nullable=False,
    )

    op.create_index(
        "ix_pembelian_spare_parts_public_receipt_token",
        "pembelian_spare_parts",
        ["public_receipt_token"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_pembelian_spare_parts_public_receipt_token",
        table_name="pembelian_spare_parts",
    )
    op.drop_column("pembelian_spare_parts", "public_receipt_token")
