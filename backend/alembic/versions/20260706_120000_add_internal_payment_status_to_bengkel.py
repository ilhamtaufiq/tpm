"""add internal payment status to transaksi penjualan bengkel

Revision ID: 20260706_120000
Revises: 20260704_120000
Create Date: 2026-07-06 12:00:00.000000+07:00

"""
from typing import Sequence, Union

from alembic import op


revision: str = "20260706_120000"
down_revision: Union[str, None] = "20260704_120000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE transaksi_penjualan_bengkel "
        "MODIFY COLUMN status_bayar "
        "ENUM('LUNAS', 'BELUM_LUNAS', 'CICILAN', 'BATAL', 'INTERNAL') "
        "NOT NULL DEFAULT 'LUNAS'"
    )
    op.execute(
        "UPDATE transaksi_penjualan_bengkel "
        "SET status_bayar = 'INTERNAL', jumlah_bayar = 0, kembalian = 0, metode_bayar = 'INTERNAL' "
        "WHERE kategori IN ('jasa_angkut', 'jual_beli_mobil') "
        "AND status_bayar NOT IN ('BATAL')"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE transaksi_penjualan_bengkel "
        "SET status_bayar = 'BELUM_LUNAS' "
        "WHERE status_bayar = 'INTERNAL'"
    )
    op.execute(
        "ALTER TABLE transaksi_penjualan_bengkel "
        "MODIFY COLUMN status_bayar "
        "ENUM('LUNAS', 'BELUM_LUNAS', 'CICILAN', 'BATAL') "
        "NOT NULL DEFAULT 'LUNAS'"
    )