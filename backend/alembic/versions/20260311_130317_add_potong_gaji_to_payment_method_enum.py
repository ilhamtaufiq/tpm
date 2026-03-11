"""add_potong_gaji_to_payment_method_enum

Revision ID: 14d285cd7b7e
Revises: 202603052230
Create Date: 2026-03-11 13:03:17.563489+07:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '14d285cd7b7e'
down_revision: Union[str, None] = '202603052230'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


FULL_ENUM = "'TUNAI','TRANSFER','KREDIT','DEBIT','SPLIT','INTERNAL','POTONG_GAJI','OTHER'"
OLD_ENUM = "'TUNAI','TRANSFER','KREDIT','DEBIT','SPLIT','INTERNAL','OTHER'"


def upgrade() -> None:
    # 1. kas_bank.metode_bayar
    op.execute(f"ALTER TABLE kas_bank MODIFY COLUMN metode_bayar ENUM({FULL_ENUM}) NULL DEFAULT 'TUNAI'")
    
    # 2. slip_gaji.metode_bayar
    op.execute(f"ALTER TABLE slip_gaji MODIFY COLUMN metode_bayar ENUM({FULL_ENUM}) NULL")
    
    # 3. transaksi_penjualan_bengkel.metode_bayar
    op.execute(f"ALTER TABLE transaksi_penjualan_bengkel MODIFY COLUMN metode_bayar ENUM({FULL_ENUM}) NOT NULL DEFAULT 'TUNAI'")
    
    # 4. pengeluaran_bengkel.metode_bayar
    op.execute(f"ALTER TABLE pengeluaran_bengkel MODIFY COLUMN metode_bayar ENUM({FULL_ENUM}) NOT NULL DEFAULT 'TUNAI'")
    
    # 5. pembelian_spare_parts.metode_bayar
    op.execute(f"ALTER TABLE pembelian_spare_parts MODIFY COLUMN metode_bayar ENUM({FULL_ENUM}) NULL")
    
    # 6. mobil.metode_bayar_beli
    op.execute(f"ALTER TABLE mobil MODIFY COLUMN metode_bayar_beli ENUM({FULL_ENUM}) NOT NULL DEFAULT 'TUNAI'")
    
    # 7. transaksi_penjualan_mobil.metode_bayar
    op.execute(f"ALTER TABLE transaksi_penjualan_mobil MODIFY COLUMN metode_bayar ENUM({FULL_ENUM}) NOT NULL DEFAULT 'TUNAI'")
    
    # 8. pembayaran_piutang.metode_bayar
    op.execute(f"ALTER TABLE pembayaran_piutang MODIFY COLUMN metode_bayar ENUM({FULL_ENUM}) NOT NULL DEFAULT 'TUNAI'")
    
    # 9. pembayaran_hutang.metode_bayar
    op.execute(f"ALTER TABLE pembayaran_hutang MODIFY COLUMN metode_bayar ENUM({FULL_ENUM}) NOT NULL DEFAULT 'TUNAI'")


def downgrade() -> None:
    # Downgrade to OLD_ENUM by converting POTONG_GAJI to OTHER first if any exist
    op.execute(f"UPDATE kas_bank SET metode_bayar = 'OTHER' WHERE metode_bayar = 'POTONG_GAJI'")
    op.execute(f"ALTER TABLE kas_bank MODIFY COLUMN metode_bayar ENUM({OLD_ENUM}) NULL DEFAULT 'TUNAI'")
    
    op.execute(f"UPDATE slip_gaji SET metode_bayar = 'OTHER' WHERE metode_bayar = 'POTONG_GAJI'")
    op.execute(f"ALTER TABLE slip_gaji MODIFY COLUMN metode_bayar ENUM({OLD_ENUM}) NULL")
    
    op.execute(f"UPDATE transaksi_penjualan_bengkel SET metode_bayar = 'OTHER' WHERE metode_bayar = 'POTONG_GAJI'")
    op.execute(f"ALTER TABLE transaksi_penjualan_bengkel MODIFY COLUMN metode_bayar ENUM({OLD_ENUM}) NOT NULL DEFAULT 'TUNAI'")
    
    op.execute(f"UPDATE pengeluaran_bengkel SET metode_bayar = 'OTHER' WHERE metode_bayar = 'POTONG_GAJI'")
    op.execute(f"ALTER TABLE pengeluaran_bengkel MODIFY COLUMN metode_bayar ENUM({OLD_ENUM}) NOT NULL DEFAULT 'TUNAI'")
    
    op.execute(f"UPDATE pembelian_spare_parts SET metode_bayar = 'OTHER' WHERE metode_bayar = 'POTONG_GAJI'")
    op.execute(f"ALTER TABLE pembelian_spare_parts MODIFY COLUMN metode_bayar ENUM({OLD_ENUM}) NULL")
    
    op.execute(f"UPDATE mobil SET metode_bayar_beli = 'OTHER' WHERE metode_bayar_beli = 'POTONG_GAJI'")
    op.execute(f"ALTER TABLE mobil MODIFY COLUMN metode_bayar_beli ENUM({OLD_ENUM}) NOT NULL DEFAULT 'TUNAI'")
    
    op.execute(f"UPDATE transaksi_penjualan_mobil SET metode_bayar = 'OTHER' WHERE metode_bayar = 'POTONG_GAJI'")
    op.execute(f"ALTER TABLE transaksi_penjualan_mobil MODIFY COLUMN metode_bayar ENUM({OLD_ENUM}) NOT NULL DEFAULT 'TUNAI'")
    
    op.execute(f"UPDATE pembayaran_piutang SET metode_bayar = 'OTHER' WHERE metode_bayar = 'POTONG_GAJI'")
    op.execute(f"ALTER TABLE pembayaran_piutang MODIFY COLUMN metode_bayar ENUM({OLD_ENUM}) NOT NULL DEFAULT 'TUNAI'")
    
    op.execute(f"UPDATE pembayaran_hutang SET metode_bayar = 'OTHER' WHERE metode_bayar = 'POTONG_GAJI'")
    op.execute(f"ALTER TABLE pembayaran_hutang MODIFY COLUMN metode_bayar ENUM({OLD_ENUM}) NOT NULL DEFAULT 'TUNAI'")
