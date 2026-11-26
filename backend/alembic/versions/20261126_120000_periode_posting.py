"""periode posting bulanan + nota tambahan (induk_nomor)

Revision ID: b3d5f7a9c1e2
Revises: a7c1e2d4f6b8
Create Date: 2026-11-26 12:00:00.000000+07:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b3d5f7a9c1e2'
down_revision: Union[str, None] = 'a7c1e2d4f6b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'periode_posting',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('tahun', sa.Integer(), nullable=False),
        sa.Column('bulan', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=12), nullable=False, server_default='TERBUKA'),
        sa.Column('diposting_pada', sa.DateTime(), nullable=True),
        sa.Column('diposting_oleh', sa.Integer(), nullable=True),
        sa.Column('catatan', sa.Text(), nullable=True),
        sa.Column('dibuka_pada', sa.DateTime(), nullable=True),
        sa.Column('dibuka_oleh', sa.Integer(), nullable=True),
        sa.Column('alasan_buka', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['diposting_oleh'], ['users.id']),
        sa.ForeignKeyConstraint(['dibuka_oleh'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tahun', 'bulan', name='uq_periode_posting_tahun_bulan'),
    )
    op.create_index('ix_periode_posting_tahun', 'periode_posting', ['tahun'])
    op.add_column(
        'transaksi_penjualan_bengkel',
        sa.Column('induk_nomor', sa.String(length=30), nullable=True),
    )
    op.create_index(
        'ix_transaksi_penjualan_bengkel_induk_nomor',
        'transaksi_penjualan_bengkel',
        ['induk_nomor'],
    )


def downgrade() -> None:
    op.drop_index('ix_transaksi_penjualan_bengkel_induk_nomor', table_name='transaksi_penjualan_bengkel')
    op.drop_column('transaksi_penjualan_bengkel', 'induk_nomor')
    op.drop_index('ix_periode_posting_tahun', table_name='periode_posting')
    op.drop_table('periode_posting')
