"""retur pembelian: nilai yang dijadikan piutang ke supplier

Revision ID: b1c2d3e4f5a6
Revises: a9c1d2e3f4b5
Create Date: 2026-10-17 11:00:00.000000+07:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = 'a9c1d2e3f4b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'retur_pembelian_spare_parts',
        sa.Column('nilai_piutang', sa.Numeric(15, 2), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.drop_column('retur_pembelian_spare_parts', 'nilai_piutang')
