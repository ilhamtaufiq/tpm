"""add_gambar_to_spare_parts

Revision ID: 157f3d4ad6ee
Revises: 67ed5a3290f1
Create Date: 2026-03-28 03:46:52.063070+07:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '157f3d4ad6ee'
down_revision: Union[str, None] = '67ed5a3290f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('spare_parts', sa.Column('gambar', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('spare_parts', 'gambar')
