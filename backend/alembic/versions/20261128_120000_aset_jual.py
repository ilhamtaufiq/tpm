"""aset tetap: pelepasan (tanggal_jual, harga_jual)

Revision ID: a1c3e5g7i9k2
Revises: f8b0d2e4a6c8
Create Date: 2026-11-28 12:00:00.000000+07:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a1c3e5g7i9k2'
down_revision: Union[str, None] = 'f8b0d2e4a6c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('aset', sa.Column('tanggal_jual', sa.Date(), nullable=True))
    op.add_column('aset', sa.Column('harga_jual', sa.Numeric(15, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('aset', 'harga_jual')
    op.drop_column('aset', 'tanggal_jual')
