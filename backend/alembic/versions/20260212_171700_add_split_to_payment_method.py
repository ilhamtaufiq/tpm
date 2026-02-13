"""add split to payment method

Revision ID: 20260212_171700
Revises: 20260212_170000
Create Date: 2026-02-12 17:17:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260212_171700'
down_revision = '20260212_170000'
branch_labels = None
depends_on = None


def upgrade():
    # MySQL specific enum update
    # We need to list all current values plus 'split'
    tables = ['pembelian_spare_parts', 'transaksi_penjualan_bengkel', 'pengeluaran_bengkel', 'transaksi_penjualan_mobil', 'pembayaran_piutang', 'kas_bank']
    for table in tables:
        op.execute(f"ALTER TABLE {table} MODIFY COLUMN metode_bayar ENUM('tunai', 'transfer', 'kredit', 'debit', 'split')")
    
    # muatan_jasa_angkut.status_bayar is a DIFFERENT enum (PaymentStatus).
    # Correcting muatan_jasa_angkut logic if needed, but not required yet for split.


def downgrade():
    # Revert back to original values
    tables = ['pembelian_spare_parts', 'transaksi_penjualan_bengkel', 'pengeluaran_bengkel', 'transaksi_penjualan_mobil', 'pembayaran_piutang', 'kas_bank']
    for table in tables:
        op.execute(f"ALTER TABLE {table} MODIFY COLUMN metode_bayar ENUM('tunai', 'transfer', 'kredit', 'debit')")
