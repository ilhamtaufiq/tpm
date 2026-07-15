"""add tampilkan_diskon_struk to transaksi_penjualan_bengkel

Revision ID: 20260715_120000
Revises: 20260707_120000
Create Date: 2026-07-15 12:00:00.000000+07:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260715_120000"
down_revision: Union[str, None] = "20260707_120000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    column_names = [c["name"] for c in inspector.get_columns("transaksi_penjualan_bengkel")]

    if "tampilkan_diskon_struk" not in column_names:
        op.add_column(
            "transaksi_penjualan_bengkel",
            sa.Column(
                "tampilkan_diskon_struk",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("1"),
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    column_names = [c["name"] for c in inspector.get_columns("transaksi_penjualan_bengkel")]

    if "tampilkan_diskon_struk" in column_names:
        op.drop_column("transaksi_penjualan_bengkel", "tampilkan_diskon_struk")
