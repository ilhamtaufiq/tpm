"""add_biaya_operasional_and_part_service_to_mobil

Revision ID: e8f9a0b1c2d3
Revises: 79faa72b9619
Create Date: 2026-08-01 00:00:00.000000+07:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = 'e8f9a0b1c2d3'
down_revision: Union[str, None] = '79faa72b9619'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('mobil', sa.Column('biaya_operasional', sa.Numeric(precision=15, scale=2), nullable=False, server_default='0'))
    op.add_column('mobil', sa.Column('biaya_part_service', sa.Numeric(precision=15, scale=2), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('mobil', 'biaya_part_service')
    op.drop_column('mobil', 'biaya_operasional')
