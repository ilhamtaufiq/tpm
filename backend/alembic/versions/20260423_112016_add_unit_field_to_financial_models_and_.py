"""add unit field to financial models and update source enums

Revision ID: 368403e438ec
Revises: 8482a6eeaebf
Create Date: 2026-04-23 11:20:16.432831+07:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '368403e438ec'
down_revision: Union[str, None] = '8482a6eeaebf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Update source enums for piutang_usaha to include LAINNYA
    op.execute("ALTER TABLE piutang_usaha MODIFY COLUMN sumber ENUM('BENGKEL', 'JUAL_BELI_MOBIL', 'JASA_ANGKUT', 'KASBON_KARYAWAN', 'LAINNYA') NOT NULL DEFAULT 'BENGKEL'")
    
    # 2. Add 'unit' column to piutang_usaha
    op.add_column('piutang_usaha', sa.Column('unit', sa.Enum('BENGKEL', 'JUAL_BELI_MOBIL', 'JASA_ANGKUT', 'PEMBELIAN_PART', 'PEMBELIAN_MOBIL', 'PENGELUARAN', 'GAJI', 'KASBON', 'PIUTANG', 'HUTANG', 'MODAL', 'PRIVE', 'ASET', 'LAINNYA', name='kasbanksource'), nullable=True))
    
    # 3. Add 'unit' column to hutang_usaha
    op.add_column('hutang_usaha', sa.Column('unit', sa.Enum('BENGKEL', 'JUAL_BELI_MOBIL', 'JASA_ANGKUT', 'PEMBELIAN_PART', 'PEMBELIAN_MOBIL', 'PENGELUARAN', 'GAJI', 'KASBON', 'PIUTANG', 'HUTANG', 'MODAL', 'PRIVE', 'ASET', 'LAINNYA', name='kasbanksource'), nullable=True))
    
    # 4. Add 'unit' column to kasbon_karyawan
    op.add_column('kasbon_karyawan', sa.Column('unit', sa.Enum('BENGKEL', 'JUAL_BELI_MOBIL', 'JASA_ANGKUT', 'PEMBELIAN_PART', 'PEMBELIAN_MOBIL', 'PENGELUARAN', 'GAJI', 'KASBON', 'PIUTANG', 'HUTANG', 'MODAL', 'PRIVE', 'ASET', 'LAINNYA', name='kasbanksource'), nullable=False, server_default='BENGKEL'))


def downgrade() -> None:
    # 1. Remove 'unit' column from kasbon_karyawan
    op.drop_column('kasbon_karyawan', 'unit')
    
    # 2. Remove 'unit' column from hutang_usaha
    op.drop_column('hutang_usaha', 'unit')
    
    # 3. Remove 'unit' column from piutang_usaha
    op.drop_column('piutang_usaha', 'unit')
    
    # 4. Revert source enums for piutang_usaha (remove LAINNYA)
    op.execute("ALTER TABLE piutang_usaha MODIFY COLUMN sumber ENUM('BENGKEL', 'JUAL_BELI_MOBIL', 'JASA_ANGKUT', 'KASBON_KARYAWAN') NOT NULL DEFAULT 'BENGKEL'")
