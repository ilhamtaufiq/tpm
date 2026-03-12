"""add investor disbursement fields

Revision ID: 20260313_001000
Revises: 20260311_130317
Create Date: 2026-03-13 00:10:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260313_001000'
down_revision = '14d285cd7b7e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the enum type first
    investor_status_enum = sa.Enum('BELUM_DICAIRKAN', 'DICAIRKAN', name='investordisbursementstatus')
    investor_status_enum.create(op.get_bind(), checkfirst=True)

    op.add_column('transaksi_penjualan_mobil', sa.Column(
        'status_pencairan',
        sa.Enum('BELUM_DICAIRKAN', 'DICAIRKAN', name='investordisbursementstatus'),
        nullable=True,
        server_default='BELUM_DICAIRKAN'
    ))
    op.add_column('transaksi_penjualan_mobil', sa.Column(
        'tanggal_pencairan', sa.Date(), nullable=True
    ))
    op.add_column('transaksi_penjualan_mobil', sa.Column(
        'nominal_pencairan', sa.Numeric(15, 2), server_default='0', nullable=False
    ))
    op.add_column('transaksi_penjualan_mobil', sa.Column(
        'metode_pencairan',
        sa.Enum('TUNAI', 'TRANSFER', 'KREDIT', 'DEBIT', 'SPLIT', 'INTERNAL', 'POTONG_GAJI', 'OTHER', name='paymentmethod'),
        nullable=True
    ))
    op.add_column('transaksi_penjualan_mobil', sa.Column(
        'catatan_pencairan', sa.Text(), nullable=True
    ))


def downgrade() -> None:
    op.drop_column('transaksi_penjualan_mobil', 'catatan_pencairan')
    op.drop_column('transaksi_penjualan_mobil', 'metode_pencairan')
    op.drop_column('transaksi_penjualan_mobil', 'nominal_pencairan')
    op.drop_column('transaksi_penjualan_mobil', 'tanggal_pencairan')
    op.drop_column('transaksi_penjualan_mobil', 'status_pencairan')
    sa.Enum(name='investordisbursementstatus').drop(op.get_bind(), checkfirst=True)
