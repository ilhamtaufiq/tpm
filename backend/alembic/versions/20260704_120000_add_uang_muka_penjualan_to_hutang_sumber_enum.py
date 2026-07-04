"""add uang muka penjualan to hutang sumber enum

Revision ID: 20260704_120000
Revises: 20260604_140000
Create Date: 2026-07-04 12:00:00.000000+07:00

"""
from typing import Sequence, Union

from alembic import op


revision: str = "20260704_120000"
down_revision: Union[str, None] = "20260604_140000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE hutang_usaha MODIFY COLUMN sumber "
        "ENUM('PEMBELIAN_PART', 'PEMBELIAN_MOBIL', 'JUAL_BELI_MOBIL', "
        "'UANG_MUKA_PENJUALAN', 'LAINNYA') "
        "NOT NULL DEFAULT 'PEMBELIAN_PART'"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE hutang_usaha MODIFY COLUMN sumber "
        "ENUM('PEMBELIAN_PART', 'PEMBELIAN_MOBIL', 'JUAL_BELI_MOBIL', 'LAINNYA') "
        "NOT NULL DEFAULT 'PEMBELIAN_PART'"
    )