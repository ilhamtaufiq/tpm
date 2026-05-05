"""add_jual_beli_mobil_to_hutang_sumber_enum

Revision ID: 20260505_224700
Revises: 20260423_120601
Create Date: 2026-05-05 22:47:00.000000+07:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260505_224700'
down_revision: Union[str, None] = 'ed090fa4ea04'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The hutang_usaha.sumber column was created with only PEMBELIAN_PART, PEMBELIAN_MOBIL, LAINNYA
    # but the HutangSource enum now also includes JUAL_BELI_MOBIL.
    # This is needed for internal workshop-to-unit repair tracking.
    op.execute(
        "ALTER TABLE hutang_usaha MODIFY COLUMN sumber "
        "ENUM('PEMBELIAN_PART', 'PEMBELIAN_MOBIL', 'JUAL_BELI_MOBIL', 'LAINNYA') "
        "NOT NULL DEFAULT 'PEMBELIAN_PART'"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE hutang_usaha MODIFY COLUMN sumber "
        "ENUM('PEMBELIAN_PART', 'PEMBELIAN_MOBIL', 'LAINNYA') "
        "NOT NULL DEFAULT 'PEMBELIAN_PART'"
    )
