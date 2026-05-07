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
    op.add_column('muatan_jasa_angkut', sa.Column('info_kendaraan', sa.String(length=255), nullable=True))
    op.create_foreign_key('fk_muatan_armada', 'muatan_jasa_angkut', 'armada_jasa_angkut', ['armada_id'], ['id'])

    # 4. Fix MuatanJasaAngkut types (from initial schema String(100) to Text)
    op.alter_column('muatan_jasa_angkut', 'jenis_muatan',
               existing_type=sa.String(length=100),
               type_=sa.Text(),
               existing_nullable=True)

    # 5. Add missing columns to mobil (purchase tracking)
    op.add_column('mobil', sa.Column('status_bayar_beli', sa.Enum('LUNAS', 'BELUM_LUNAS', 'CICILAN', name='paymentstatus'), nullable=False, server_default=sa.text("'LUNAS'")))
    op.add_column('mobil', sa.Column('metode_bayar_beli', sa.Enum('TUNAI', 'TRANSFER', 'KREDIT', 'DEBIT', 'SPLIT', 'INTERNAL', 'OTHER', name='paymentmethod'), nullable=False, server_default=sa.text("'TUNAI'")))
    op.add_column('mobil', sa.Column('dp_beli', sa.Numeric(precision=15, scale=2), nullable=False, server_default=sa.text("'0.00'")))

    # 6. Add phone column to users
    op.add_column('users', sa.Column('phone', sa.String(length=20), nullable=True))

    # 7. Create missing hutang_usaha table
    op.create_table('hutang_usaha',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('nomor_hutang', sa.String(length=30), nullable=False),
        sa.Column('tanggal', sa.Date(), nullable=False),
        sa.Column('sumber', sa.Enum('PEMBELIAN_PART', 'PEMBELIAN_MOBIL', 'LAINNYA', name='hutangsource'), nullable=False),
        sa.Column('referensi_id', sa.Integer(), nullable=True),
        sa.Column('nomor_referensi', sa.String(length=30), nullable=True),
        sa.Column('supplier_id', sa.Integer(), nullable=True),
        sa.Column('nama_kreditur', sa.String(length=100), nullable=False),
        sa.Column('telepon_kreditur', sa.String(length=20), nullable=True),
        sa.Column('alamat_kreditur', sa.Text(), nullable=True),
        sa.Column('nominal_hutang', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('total_dibayar', sa.Numeric(precision=15, scale=2), nullable=False, server_default=sa.text("'0.00'")),
        sa.Column('sisa_hutang', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('tanggal_jatuh_tempo', sa.Date(), nullable=True),
        sa.Column('tanggal_lunas', sa.Date(), nullable=True),
        sa.Column('status', sa.Enum('BELUM_LUNAS', 'LUNAS', 'SEBAGIAN', 'BATAL', name='hutangstatus'), nullable=False, server_default=sa.text("'BELUM_LUNAS'")),
        sa.Column('catatan', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_hutang_usaha_nomor_hutang'), 'hutang_usaha', ['nomor_hutang'], unique=True)
    op.create_index(op.f('ix_hutang_usaha_tanggal'), 'hutang_usaha', ['tanggal'], unique=False)
    op.create_index(op.f('ix_hutang_usaha_supplier_id'), 'hutang_usaha', ['supplier_id'], unique=False)

    # 8. Create missing pembayaran_hutang table
    op.create_table('pembayaran_hutang',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('hutang_id', sa.Integer(), nullable=False),
        sa.Column('tanggal', sa.Date(), nullable=False),
        sa.Column('nominal', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('metode_bayar', sa.Enum('TUNAI', 'TRANSFER', 'KREDIT', 'DEBIT', 'SPLIT', name='paymentmethod'), nullable=False, server_default=sa.text("'TUNAI'")),
        sa.Column('catatan', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['hutang_id'], ['hutang_usaha.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_pembayaran_hutang_hutang_id'), 'pembayaran_hutang', ['hutang_id'], unique=False)
    op.create_index(op.f('ix_pembayaran_hutang_tanggal'), 'pembayaran_hutang', ['tanggal'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_pembayaran_hutang_tanggal'), table_name='pembayaran_hutang')
    op.drop_index(op.f('ix_pembayaran_hutang_hutang_id'), table_name='pembayaran_hutang')
    op.drop_table('pembayaran_hutang')
    op.drop_index(op.f('ix_hutang_usaha_supplier_id'), table_name='hutang_usaha')
    op.drop_index(op.f('ix_hutang_usaha_tanggal'), table_name='hutang_usaha')
    op.drop_index(op.f('ix_hutang_usaha_nomor_hutang'), table_name='hutang_usaha')
    op.drop_table('hutang_usaha')
    op.drop_column('users', 'phone')
    op.drop_column('mobil', 'dp_beli')
    op.drop_column('mobil', 'metode_bayar_beli')
    op.drop_column('mobil', 'status_bayar_beli')
    op.alter_column('muatan_jasa_angkut', 'jenis_muatan',
               existing_type=sa.Text(),
               type_=sa.String(length=100),
               existing_nullable=True)
    op.drop_constraint('fk_muatan_armada', 'muatan_jasa_angkut', type_='foreignkey')
    op.drop_column('muatan_jasa_angkut', 'info_kendaraan')
    op.drop_column('muatan_jasa_angkut', 'armada_id')
    op.drop_constraint('fk_supir_armada_default', 'supir', type_='foreignkey')
    op.drop_column('supir', 'info_kendaraan')
    op.drop_column('supir', 'nopol_kendaraan')
    op.drop_column('supir', 'armada_default_id')
    op.drop_index(op.f('ix_armada_jasa_angkut_nopol'), table_name='armada_jasa_angkut')
    op.drop_index(op.f('ix_armada_jasa_angkut_nama'), table_name='armada_jasa_angkut')
    op.drop_table('armada_jasa_angkut')
