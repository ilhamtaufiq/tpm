"""add_spare_part_revaluation

Revision ID: d1a2b3c4d5e6
Revises: c66f34535767
Create Date: 2026-08-15 12:00:00.000000+07:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd1a2b3c4d5e6'
down_revision: Union[str, None] = 'c66f34535767'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'spare_part_revaluation',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('spare_part_id', sa.Integer(), nullable=False),
        sa.Column('pembelian_id', sa.Integer(), nullable=False),
        sa.Column('tanggal', sa.Date(), nullable=False),
        sa.Column('qty_at_reval', sa.Numeric(15, 2), nullable=False),
        sa.Column('harga_lama', sa.Numeric(15, 2), nullable=False),
        sa.Column('harga_baru', sa.Numeric(15, 2), nullable=False),
        sa.Column('amount', sa.Numeric(15, 2), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['pembelian_id'], ['pembelian_spare_parts.id'], ),
        sa.ForeignKeyConstraint(['spare_part_id'], ['spare_parts.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_spare_part_revaluation_pembelian_id'),
        'spare_part_revaluation', ['pembelian_id'], unique=False,
    )
    op.create_index(
        op.f('ix_spare_part_revaluation_spare_part_id'),
        'spare_part_revaluation', ['spare_part_id'], unique=False,
    )
    op.create_index(
        op.f('ix_spare_part_revaluation_tanggal'),
        'spare_part_revaluation', ['tanggal'], unique=False,
    )
    op.create_table(
        'spare_part_revaluation_release',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('revaluation_id', sa.Integer(), nullable=False),
        sa.Column('transaksi_id', sa.Integer(), nullable=False),
        sa.Column('tanggal', sa.Date(), nullable=False),
        sa.Column('qty', sa.Numeric(15, 2), nullable=False),
        sa.Column('amount', sa.Numeric(15, 2), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['revaluation_id'], ['spare_part_revaluation.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['transaksi_id'], ['transaksi_penjualan_bengkel.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_spare_part_revaluation_release_revaluation_id'),
        'spare_part_revaluation_release', ['revaluation_id'], unique=False,
    )
    op.create_index(
        op.f('ix_spare_part_revaluation_release_tanggal'),
        'spare_part_revaluation_release', ['tanggal'], unique=False,
    )
    op.create_index(
        op.f('ix_spare_part_revaluation_release_transaksi_id'),
        'spare_part_revaluation_release', ['transaksi_id'], unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_spare_part_revaluation_release_transaksi_id'), table_name='spare_part_revaluation_release')
    op.drop_index(op.f('ix_spare_part_revaluation_release_tanggal'), table_name='spare_part_revaluation_release')
    op.drop_index(op.f('ix_spare_part_revaluation_release_revaluation_id'), table_name='spare_part_revaluation_release')
    op.drop_table('spare_part_revaluation_release')
    op.drop_index(op.f('ix_spare_part_revaluation_tanggal'), table_name='spare_part_revaluation')
    op.drop_index(op.f('ix_spare_part_revaluation_spare_part_id'), table_name='spare_part_revaluation')
    op.drop_index(op.f('ix_spare_part_revaluation_pembelian_id'), table_name='spare_part_revaluation')
    op.drop_table('spare_part_revaluation')
