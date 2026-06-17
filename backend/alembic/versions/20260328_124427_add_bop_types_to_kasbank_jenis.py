"""add_bop_types_to_kasbank_jenis

Revision ID: 697ef77fdde1
Revises: 157f3d4ad6ee
Create Date: 2026-03-28 12:44:27.734852+07:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '697ef77fdde1'
down_revision: Union[str, None] = '157f3d4ad6ee'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Update KasBankJenis in kas_bank table
    op.execute(
        "ALTER TABLE kas_bank "
        "MODIFY COLUMN jenis ENUM("
        "'CASH','BANK_BCA','BANK_MANDIRI','BANK_BRI','BANK_LAINNYA',"
        "'BOP_JASA_ANGKUT_CASH','BOP_JASA_ANGKUT_BCA','BOP_MOBIL_CASH','BOP_MOBIL_BCA'"
        ") NOT NULL DEFAULT 'CASH'"
    )


def downgrade() -> None:
    # Revert to previous enum (without BOP accounts)
    op.execute(
        "ALTER TABLE kas_bank "
        "MODIFY COLUMN jenis ENUM("
        "'CASH','BANK_BCA','BANK_MANDIRI','BANK_BRI','BANK_LAINNYA'"
        ") NOT NULL DEFAULT 'CASH'"
    )
