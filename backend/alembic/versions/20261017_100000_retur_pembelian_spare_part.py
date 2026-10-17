"""tabel retur pembelian spare part

Retur barang pembelian ke supplier: stok berkurang, nilai retur mengurangi
hutang pembelian dulu, sisanya dikembalikan supplier ke kas.

Revision ID: a9c1d2e3f4b5
Revises: f1a2b3c4d5e6
Create Date: 2026-10-17 10:00:00.000000+07:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a9c1d2e3f4b5'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

METODE = ('TUNAI', 'TRANSFER', 'KREDIT', 'DEBIT', 'SPLIT', 'INTERNAL', 'POTONG_GAJI', 'OTHER')


def upgrade() -> None:
    op.create_table(
        'retur_pembelian_spare_parts',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('nomor_retur', sa.String(30), nullable=False, unique=True),
        sa.Column('pembelian_id', sa.Integer(), sa.ForeignKey('pembelian_spare_parts.id'), nullable=False),
        sa.Column('tanggal', sa.Date(), nullable=False),
        sa.Column('total_retur', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('nilai_hutang', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('nilai_kas', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('metode_refund', sa.Enum(*METODE), nullable=True),
        sa.Column('catatan', sa.Text(), nullable=True),
        sa.Column('dibatalkan', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_retur_pembelian_spare_parts_pembelian_id', 'retur_pembelian_spare_parts', ['pembelian_id'])
    op.create_index('ix_retur_pembelian_spare_parts_tanggal', 'retur_pembelian_spare_parts', ['tanggal'])

    op.create_table(
        'detail_retur_pembelian_spare_parts',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('retur_id', sa.Integer(), sa.ForeignKey('retur_pembelian_spare_parts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('detail_pembelian_id', sa.Integer(), sa.ForeignKey('detail_pembelian_spare_parts.id'), nullable=False),
        sa.Column('spare_part_id', sa.Integer(), sa.ForeignKey('spare_parts.id'), nullable=False),
        sa.Column('qty', sa.Numeric(15, 2), nullable=False),
        sa.Column('harga_satuan', sa.Numeric(15, 2), nullable=False),
        sa.Column('subtotal', sa.Numeric(15, 2), nullable=False),
    )
    op.create_index('ix_detail_retur_pembelian_spare_parts_retur_id', 'detail_retur_pembelian_spare_parts', ['retur_id'])
    op.create_index('ix_detail_retur_pembelian_spare_parts_detail_pembelian_id', 'detail_retur_pembelian_spare_parts', ['detail_pembelian_id'])


def downgrade() -> None:
    op.drop_table('detail_retur_pembelian_spare_parts')
    op.drop_table('retur_pembelian_spare_parts')
