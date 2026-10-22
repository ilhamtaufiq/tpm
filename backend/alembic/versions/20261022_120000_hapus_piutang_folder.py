"""hapus folder piutang manual (diganti pengelompokan otomatis per nama)

Revision ID: cce232d5cf7e
Revises: 963bcd267437
Create Date: 2026-10-22 12:00:00.000000+07:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'cce232d5cf7e'
down_revision: Union[str, None] = '963bcd267437'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint('fk_piutang_usaha_folder', 'piutang_usaha', type_='foreignkey')
    op.drop_index('ix_piutang_usaha_folder_id', table_name='piutang_usaha')
    op.drop_column('piutang_usaha', 'folder_id')
    op.drop_index('ix_piutang_folder_nama', table_name='piutang_folder')
    op.drop_table('piutang_folder')


def downgrade() -> None:
    op.create_table(
        'piutang_folder',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('nama', sa.String(length=100), nullable=False),
        sa.Column('catatan', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_piutang_folder_nama', 'piutang_folder', ['nama'], unique=True)
    op.add_column('piutang_usaha', sa.Column('folder_id', sa.Integer(), nullable=True))
    op.create_index('ix_piutang_usaha_folder_id', 'piutang_usaha', ['folder_id'])
    op.create_foreign_key('fk_piutang_usaha_folder', 'piutang_usaha', 'piutang_folder', ['folder_id'], ['id'])
