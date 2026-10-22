"""riwayat perbaikan data (dashboard Perbaikan Data)

Revision ID: c3d4e5f6a7b8
Revises: b1c2d3e4f5a6
Create Date: 2026-10-20 12:00:00.000000+07:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'perbaikan_data_log',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('jenis', sa.String(length=40), nullable=False),
        sa.Column('nomor_referensi', sa.String(length=50), nullable=False),
        sa.Column('ringkasan', sa.String(length=255), nullable=False),
        sa.Column('sebelum', sa.Text(), nullable=True),
        sa.Column('sesudah', sa.Text(), nullable=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_perbaikan_data_log_jenis', 'perbaikan_data_log', ['jenis'])
    op.create_index('ix_perbaikan_data_log_nomor_referensi', 'perbaikan_data_log', ['nomor_referensi'])


def downgrade() -> None:
    op.drop_index('ix_perbaikan_data_log_nomor_referensi', table_name='perbaikan_data_log')
    op.drop_index('ix_perbaikan_data_log_jenis', table_name='perbaikan_data_log')
    op.drop_table('perbaikan_data_log')
