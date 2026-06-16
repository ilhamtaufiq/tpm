"""add_batal_status_to_piutang_and_penjualan

Revision ID: 9cb446e5c81c
Revises: 26144a023833
Create Date: 2026-03-27 11:18:23.262050+07:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9cb446e5c81c'
down_revision: Union[str, None] = '26144a023833'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Update piutang_usaha status enum
    op.execute("ALTER TABLE piutang_usaha MODIFY COLUMN status ENUM('BELUM_LUNAS', 'LUNAS', 'SEBAGIAN', 'BATAL') NOT NULL DEFAULT 'BELUM_LUNAS'")
    
    # 2. Update hutang_usaha status enum
    op.execute("ALTER TABLE hutang_usaha MODIFY COLUMN status ENUM('BELUM_LUNAS', 'LUNAS', 'SEBAGIAN', 'BATAL') NOT NULL DEFAULT 'BELUM_LUNAS'")
    
    # 3. Update transaksi_penjualan_mobil status_bayar enum and make mobil_id nullable
    op.execute("ALTER TABLE transaksi_penjualan_mobil MODIFY COLUMN status_bayar ENUM('LUNAS', 'BELUM_LUNAS', 'CICILAN', 'BATAL') NOT NULL DEFAULT 'LUNAS'")
    
    # Allow NULL for mobil_id to support detaching cancelled transactions
    op.execute("ALTER TABLE transaksi_penjualan_mobil MODIFY COLUMN mobil_id INT NULL")


def downgrade() -> None:
    # Note: Downgrading will fail if there are existing 'BATAL' records or NULL mobil_id.
    op.execute("ALTER TABLE piutang_usaha MODIFY COLUMN status ENUM('BELUM_LUNAS', 'LUNAS', 'SEBAGIAN') NOT NULL DEFAULT 'BELUM_LUNAS'")
    op.execute("ALTER TABLE hutang_usaha MODIFY COLUMN status ENUM('BELUM_LUNAS', 'LUNAS', 'SEBAGIAN') NOT NULL DEFAULT 'BELUM_LUNAS'")
    op.execute("ALTER TABLE transaksi_penjualan_mobil MODIFY COLUMN status_bayar ENUM('LUNAS', 'BELUM_LUNAS', 'CICILAN') NOT NULL DEFAULT 'LUNAS'")
    op.execute("ALTER TABLE transaksi_penjualan_mobil MODIFY COLUMN mobil_id INT NOT NULL")
