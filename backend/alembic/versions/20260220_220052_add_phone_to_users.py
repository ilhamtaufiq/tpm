"""add phone to users

Revision ID: df64ee66aab1
Revises: 20260212_171700
Create Date: 2026-02-20 22:00:52.895339+07:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = 'df64ee66aab1'
down_revision: Union[str, None] = '20260212_171700'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create missing table armada_jasa_angkut
    op.create_table('armada_jasa_angkut',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('nama', sa.String(length=100), nullable=False),
        sa.Column('nopol', sa.String(length=20), nullable=False),
        sa.Column('jenis', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('catatan', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_armada_jasa_angkut_nama'), 'armada_jasa_angkut', ['nama'], unique=False)
    op.create_index(op.f('ix_armada_jasa_angkut_nopol'), 'armada_jasa_angkut', ['nopol'], unique=True)

    # 2. Add missing columns to supir
    op.add_column('supir', sa.Column('armada_default_id', sa.Integer(), nullable=True))
    op.add_column('supir', sa.Column('nopol_kendaraan', sa.String(length=20), nullable=True))
    op.add_column('supir', sa.Column('info_kendaraan', sa.String(length=255), nullable=True))
    op.create_foreign_key('fk_supir_armada_default', 'supir', 'armada_jasa_angkut', ['armada_default_id'], ['id'])

    # 3. Add missing columns to muatan_jasa_angkut
    op.add_column('muatan_jasa_angkut', sa.Column('armada_id', sa.Integer(), nullable=True))
    op.add_column('muatan_jasa_angkut', sa.Column('nopol', sa.String(length=20), nullable=True))
    op.add_column('muatan_jasa_angkut', sa.Column('info_kendaraan', sa.String(length=255), nullable=True))
    op.create_foreign_key('fk_muatan_armada', 'muatan_jasa_angkut', 'armada_jasa_angkut', ['armada_id'], ['id'])

    # 4. Fix MuatanJasaAngkut types (from initial schema String(100) to Text)
    op.alter_column('muatan_jasa_angkut', 'jenis_muatan',
               existing_type=sa.String(length=100),
               type_=sa.Text(),
               existing_nullable=True)

    # 5. Add phone column to users
    op.add_column('users', sa.Column('phone', sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'phone')
    op.alter_column('muatan_jasa_angkut', 'jenis_muatan',
               existing_type=sa.Text(),
               type_=sa.String(length=100),
               existing_nullable=True)
    op.drop_constraint('fk_muatan_armada', 'muatan_jasa_angkut', type_='foreignkey')
    op.drop_column('muatan_jasa_angkut', 'info_kendaraan')
    op.drop_column('muatan_jasa_angkut', 'nopol')
    op.drop_column('muatan_jasa_angkut', 'armada_id')
    op.drop_constraint('fk_supir_armada_default', 'supir', type_='foreignkey')
    op.drop_column('supir', 'info_kendaraan')
    op.drop_column('supir', 'nopol_kendaraan')
    op.drop_column('supir', 'armada_default_id')
    op.drop_index(op.f('ix_armada_jasa_angkut_nopol'), table_name='armada_jasa_angkut')
    op.drop_index(op.f('ix_armada_jasa_angkut_nama'), table_name='armada_jasa_angkut')
    op.drop_table('armada_jasa_angkut')
