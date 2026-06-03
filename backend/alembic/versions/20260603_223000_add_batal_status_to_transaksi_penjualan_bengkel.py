"""add_batal_status_to_transaksi_penjualan_bengkel

Revision ID: 20260603_223000
Revises: 20260603_160000
Create Date: 2026-06-03 22:30:00.000000+07:00

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "20260603_223000"
down_revision: Union[str, None] = "20260603_160000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE transaksi_penjualan_bengkel "
        "MODIFY COLUMN status_bayar "
        "ENUM('LUNAS', 'BELUM_LUNAS', 'CICILAN', 'BATAL') "
        "NOT NULL DEFAULT 'LUNAS'"
    )


def downgrade() -> None:
    # Downgrade is unsafe if any cancelled workshop transaction already exists.
    op.execute(
        "ALTER TABLE transaksi_penjualan_bengkel "
        "MODIFY COLUMN status_bayar "
        "ENUM('LUNAS', 'BELUM_LUNAS', 'CICILAN') "
        "NOT NULL DEFAULT 'LUNAS'"
    )
