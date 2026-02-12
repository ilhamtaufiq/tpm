"""add bengkel categories

Revision ID: 20260212_170000
Revises: e79333255550
Create Date: 2026-02-12 17:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260212_170000'
down_revision = 'e79333255550'
branch_labels = None
depends_on = None


def upgrade():
    # Add columns to transaksi_penjualan_bengkel
    op.add_column('transaksi_penjualan_bengkel', sa.Column('kategori', sa.String(length=30), nullable=True))
    op.add_column('transaksi_penjualan_bengkel', sa.Column('muatan_id', sa.Integer(), nullable=True))
    op.add_column('transaksi_penjualan_bengkel', sa.Column('mobil_id', sa.Integer(), nullable=True))
    
    # Add foreign keys
    op.create_foreign_key('fk_bengkel_muatan', 'transaksi_penjualan_bengkel', 'muatan_jasa_angkut', ['muatan_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_bengkel_mobil', 'transaksi_penjualan_bengkel', 'mobil', ['mobil_id'], ['id'], ondelete='SET NULL')
    
    # Set default category for existing records
    op.execute("UPDATE transaksi_penjualan_bengkel SET kategori = 'Umum'")


def downgrade():
    op.drop_constraint('fk_bengkel_mobil', 'transaksi_penjualan_bengkel', type_='foreignkey')
    op.drop_constraint('fk_bengkel_muatan', 'transaksi_penjualan_bengkel', type_='foreignkey')
    op.drop_column('transaksi_penjualan_bengkel', 'mobil_id')
    op.drop_column('transaksi_penjualan_bengkel', 'muatan_id')
    op.drop_column('transaksi_penjualan_bengkel', 'kategori')
