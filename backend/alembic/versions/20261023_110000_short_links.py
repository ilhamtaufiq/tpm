"""tabel short_links untuk kode pendek link struk publik

Revision ID: a3c5e7f9b1d2
Revises: 7d2e9a4b1c3f
Create Date: 2026-10-23 11:00:00.000000+07:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a3c5e7f9b1d2'
down_revision: Union[str, None] = '7d2e9a4b1c3f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'short_links',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('kode', sa.String(length=12), nullable=False),
        sa.Column('tipe', sa.String(length=20), nullable=False),
        sa.Column('target', sa.String(length=80), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('tipe', 'target', name='uq_short_links_tipe_target'),
    )
    op.create_index('ix_short_links_kode', 'short_links', ['kode'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_short_links_kode', table_name='short_links')
    op.drop_table('short_links')
