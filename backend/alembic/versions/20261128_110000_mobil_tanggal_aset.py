"""mobil: tanggal_aset (unit dipindah ke aset tetap, keluar dari stok)

Revision ID: f8b0d2e4a6c8
Revises: e7a9c1b3d5f7
Create Date: 2026-11-28 11:00:00.000000+07:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'f8b0d2e4a6c8'
down_revision: Union[str, None] = 'e7a9c1b3d5f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('mobil', sa.Column('tanggal_aset', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('mobil', 'tanggal_aset')
