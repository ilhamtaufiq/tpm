"""alasan pembatalan transaksi bengkel (wajib saat batal)

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-10-22 10:00:00.000000+07:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'transaksi_penjualan_bengkel',
        sa.Column('alasan_batal', sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('transaksi_penjualan_bengkel', 'alasan_batal')
