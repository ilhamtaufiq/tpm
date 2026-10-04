"""add sumber_dana to aset

Revision ID: e5f6a7b8c9d0
Revises: d1e2f3a4b5c6
Create Date: 2026-10-05 09:00:00

Sumber dana pembelian aset tetap: KAS (kas/bank keluar, sisa jadi hutang),
HUTANG (seluruhnya hutang), SETORAN_MODAL (setoran pemilik non-kas).
NULL = aset lama / hasil import saldo awal.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd1e2f3a4b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('aset', sa.Column('sumber_dana', sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column('aset', 'sumber_dana')
