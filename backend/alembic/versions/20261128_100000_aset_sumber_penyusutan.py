"""aset tetap: sumber aset (MANUAL/ARMADA/MOBIL) dan referensi unit

Revision ID: e7a9c1b3d5f7
Revises: d5f7a9c1e3b5
Create Date: 2026-11-28 10:00:00.000000+07:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'e7a9c1b3d5f7'
down_revision: Union[str, None] = 'd5f7a9c1e3b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('aset', sa.Column('sumber_aset', sa.String(length=10), nullable=False, server_default='MANUAL'))
    op.add_column('aset', sa.Column('referensi_id', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('aset', 'referensi_id')
    op.drop_column('aset', 'sumber_aset')
