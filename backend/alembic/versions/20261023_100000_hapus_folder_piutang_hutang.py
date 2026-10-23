"""hapus folder manual piutang dan hutang (diganti pengelompokan otomatis per nama)

Revision ID: 7d2e9a4b1c3f
Revises: f8a9b0c1d2e3
Create Date: 2026-10-23 10:00:00.000000+07:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = '7d2e9a4b1c3f'
down_revision: Union[str, None] = 'f8a9b0c1d2e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _buat_folder(nama_tabel: str) -> None:
    op.create_table(
        nama_tabel,
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('nama', sa.String(length=100), nullable=False),
        sa.Column('catatan', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index(f'ix_{nama_tabel}_nama', nama_tabel, ['nama'], unique=True)


def upgrade() -> None:
    op.drop_constraint('fk_hutang_usaha_folder', 'hutang_usaha', type_='foreignkey')
    op.drop_index('ix_hutang_usaha_folder_id', table_name='hutang_usaha')
    op.drop_column('hutang_usaha', 'folder_id')
    op.drop_index('ix_hutang_folder_nama', table_name='hutang_folder')
    op.drop_table('hutang_folder')

    op.drop_constraint('fk_piutang_usaha_folder', 'piutang_usaha', type_='foreignkey')
    op.drop_index('ix_piutang_usaha_folder_id', table_name='piutang_usaha')
    op.drop_column('piutang_usaha', 'folder_id')
    op.drop_index('ix_piutang_folder_nama', table_name='piutang_folder')
    op.drop_table('piutang_folder')


def downgrade() -> None:
    _buat_folder('piutang_folder')
    op.add_column('piutang_usaha', sa.Column('folder_id', sa.Integer(), nullable=True))
    op.create_index('ix_piutang_usaha_folder_id', 'piutang_usaha', ['folder_id'])
    op.create_foreign_key('fk_piutang_usaha_folder', 'piutang_usaha', 'piutang_folder', ['folder_id'], ['id'])

    _buat_folder('hutang_folder')
    op.add_column('hutang_usaha', sa.Column('folder_id', sa.Integer(), nullable=True))
    op.create_index('ix_hutang_usaha_folder_id', 'hutang_usaha', ['folder_id'])
    op.create_foreign_key('fk_hutang_usaha_folder', 'hutang_usaha', 'hutang_folder', ['folder_id'], ['id'])
