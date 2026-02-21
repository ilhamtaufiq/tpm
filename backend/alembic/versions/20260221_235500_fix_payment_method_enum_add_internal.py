"""fix_payment_method_enum_add_internal

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-21 23:55:00.000000+07:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# The full PaymentMethod enum values that should exist everywhere
FULL_ENUM = "'TUNAI','TRANSFER','KREDIT','DEBIT','SPLIT','INTERNAL','OTHER'"


def upgrade() -> None:
    # Fix transaksi_penjualan_bengkel.metode_bayar - missing INTERNAL, OTHER
    op.execute(
        f"ALTER TABLE transaksi_penjualan_bengkel "
        f"MODIFY COLUMN metode_bayar ENUM({FULL_ENUM}) NOT NULL DEFAULT 'TUNAI'"
    )
    
    # Fix pengeluaran_bengkel.metode_bayar - missing INTERNAL
    op.execute(
        f"ALTER TABLE pengeluaran_bengkel "
        f"MODIFY COLUMN metode_bayar ENUM({FULL_ENUM}) NOT NULL DEFAULT 'TUNAI'"
    )
    
    # Fix transaksi_penjualan_mobil.metode_bayar - might be lowercase or missing INTERNAL
    op.execute(
        f"ALTER TABLE transaksi_penjualan_mobil "
        f"MODIFY COLUMN metode_bayar ENUM({FULL_ENUM}) NOT NULL"
    )
    
    # Fix pembelian_spare_parts.metode_bayar - might be missing INTERNAL/OTHER/SPLIT
    op.execute(
        f"ALTER TABLE pembelian_spare_parts "
        f"MODIFY COLUMN metode_bayar ENUM({FULL_ENUM}) NULL"
    )
    
    # Fix slip_gaji.metode_bayar - might be missing INTERNAL/OTHER/SPLIT
    op.execute(
        f"ALTER TABLE slip_gaji "
        f"MODIFY COLUMN metode_bayar ENUM({FULL_ENUM}) NULL"
    )
    
    # Fix kas_bank.metode_bayar if it exists
    try:
        op.execute(
            f"ALTER TABLE kas_bank "
            f"MODIFY COLUMN metode_bayar ENUM({FULL_ENUM}) NULL"
        )
    except Exception:
        pass  # Column may not exist in kas_bank


def downgrade() -> None:
    # Revert to previous enum (without INTERNAL)
    OLD_ENUM = "'TUNAI','TRANSFER','KREDIT','DEBIT','SPLIT','OTHER'"
    
    op.execute(
        f"ALTER TABLE transaksi_penjualan_bengkel "
        f"MODIFY COLUMN metode_bayar ENUM({OLD_ENUM}) NOT NULL DEFAULT 'TUNAI'"
    )
    op.execute(
        f"ALTER TABLE pengeluaran_bengkel "
        f"MODIFY COLUMN metode_bayar ENUM({OLD_ENUM}) NOT NULL DEFAULT 'TUNAI'"
    )
    op.execute(
        f"ALTER TABLE transaksi_penjualan_mobil "
        f"MODIFY COLUMN metode_bayar ENUM({OLD_ENUM}) NOT NULL"
    )
    op.execute(
        f"ALTER TABLE pembelian_spare_parts "
        f"MODIFY COLUMN metode_bayar ENUM({OLD_ENUM}) NULL"
    )
    op.execute(
        f"ALTER TABLE slip_gaji "
        f"MODIFY COLUMN metode_bayar ENUM({OLD_ENUM}) NULL"
    )
