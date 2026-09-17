"""add_harga_beli_awal_to_mobil

Revision ID: a7b8c9d0e1f2
Revises: f3a4b5c6d7e8
Create Date: 2026-09-17 12:00:00.000000+07:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, None] = 'f3a4b5c6d7e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Harga beli saat unit dibuat — basis revaluasi. Selisih
    # `harga_beli - harga_beli_awal` diakui sebagai setoran modal non-kas
    # di Laporan Perubahan Modal, sehingga edit harga beli tidak
    # memunculkan selisih. Backfill = harga_beli (revaluasi awal 0).
    op.add_column(
        'mobil',
        sa.Column('harga_beli_awal', sa.Numeric(precision=15, scale=2), nullable=False, server_default='0'),
    )
    op.execute("UPDATE mobil SET harga_beli_awal = harga_beli")


def downgrade() -> None:
    op.drop_column('mobil', 'harga_beli_awal')
