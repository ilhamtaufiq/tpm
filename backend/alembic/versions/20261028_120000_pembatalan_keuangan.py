"""pembatalan keuangan: riwayat pembatalan dan kolom batal pengeluaran

Revision ID: d4e6f8a0b2c3
Revises: a3c5e7f9b1d2
Create Date: 2026-10-28 12:00:00.000000+07:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'd4e6f8a0b2c3'
down_revision: Union[str, None] = 'a3c5e7f9b1d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'pembatalan_keuangan',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('jenis', sa.String(length=40), nullable=False),
        sa.Column('nomor_dokumen', sa.String(length=50), nullable=False),
        sa.Column('dokumen_id', sa.Integer(), nullable=True),
        sa.Column('ringkasan', sa.String(length=255), nullable=False),
        sa.Column('nominal', sa.Numeric(15, 2), nullable=False),
        sa.Column('alasan', sa.Text(), nullable=False),
        sa.Column('kas_nomor', sa.Text(), nullable=True),
        sa.Column('dibatalkan_at', sa.DateTime(), nullable=False),
        sa.Column('dibatalkan_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_pembatalan_keuangan_jenis', 'pembatalan_keuangan', ['jenis'])
    op.create_index('ix_pembatalan_keuangan_nomor_dokumen', 'pembatalan_keuangan', ['nomor_dokumen'])
    op.create_index('ix_pembatalan_keuangan_dibatalkan_at', 'pembatalan_keuangan', ['dibatalkan_at'])

    op.add_column('pengeluaran_bengkel', sa.Column('dibatalkan_at', sa.DateTime(), nullable=True))
    op.add_column('pengeluaran_bengkel', sa.Column('dibatalkan_by', sa.Integer(), nullable=True))
    op.add_column('pengeluaran_bengkel', sa.Column('alasan_batal', sa.String(length=255), nullable=True))
    op.create_foreign_key(
        'fk_pengeluaran_bengkel_dibatalkan_by', 'pengeluaran_bengkel', 'users', ['dibatalkan_by'], ['id']
    )
    op.create_index('ix_pengeluaran_bengkel_dibatalkan_at', 'pengeluaran_bengkel', ['dibatalkan_at'])

    # Jurnal kas asli dan jurnal balik ikut disembunyikan saat dibatalkan.
    op.add_column('kas_bank', sa.Column('dibatalkan_at', sa.DateTime(), nullable=True))
    op.create_index('ix_kas_bank_dibatalkan_at', 'kas_bank', ['dibatalkan_at'])

    # Baris turunan pengeluaran (biaya part di armada & mobil) ikut dibatalkan.
    for tabel in ('jasa_angkut_part_service', 'mobil_part_service'):
        op.add_column(tabel, sa.Column('dibatalkan_at', sa.DateTime(), nullable=True))
        op.create_index(f'ix_{tabel}_dibatalkan_at', tabel, ['dibatalkan_at'])


def downgrade() -> None:
    op.drop_index('ix_kas_bank_dibatalkan_at', table_name='kas_bank')
    op.drop_column('kas_bank', 'dibatalkan_at')
    for tabel in ('mobil_part_service', 'jasa_angkut_part_service'):
        op.drop_index(f'ix_{tabel}_dibatalkan_at', table_name=tabel)
        op.drop_column(tabel, 'dibatalkan_at')
    op.drop_index('ix_pengeluaran_bengkel_dibatalkan_at', table_name='pengeluaran_bengkel')
    op.drop_constraint('fk_pengeluaran_bengkel_dibatalkan_by', 'pengeluaran_bengkel', type_='foreignkey')
    op.drop_column('pengeluaran_bengkel', 'alasan_batal')
    op.drop_column('pengeluaran_bengkel', 'dibatalkan_by')
    op.drop_column('pengeluaran_bengkel', 'dibatalkan_at')
    op.drop_index('ix_pembatalan_keuangan_dibatalkan_at', table_name='pembatalan_keuangan')
    op.drop_index('ix_pembatalan_keuangan_nomor_dokumen', table_name='pembatalan_keuangan')
    op.drop_index('ix_pembatalan_keuangan_jenis', table_name='pembatalan_keuangan')
    op.drop_table('pembatalan_keuangan')
