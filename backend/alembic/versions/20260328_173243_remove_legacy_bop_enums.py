"""remove_legacy_bop_enums

Revision ID: 5ecd2a974e47
Revises: 697ef77fdde1
Create Date: 2026-03-28 17:32:43.788827+07:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5ecd2a974e47'
down_revision: Union[str, None] = '697ef77fdde1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Manual update of ENUM values to remove BOP_... legacy accounts
    op.execute(
        "ALTER TABLE kas_bank MODIFY COLUMN jenis ENUM("
        "'CASH','BANK_BCA','BANK_MANDIRI','BANK_BRI','BANK_LAINNYA',"
        "'KAS_UNIT_BENGKEL','KAS_UNIT_JASA_ANGKUT','KAS_UNIT_MOBIL',"
        "'KAS_UTAMA','BANK_UTAMA') NOT NULL DEFAULT 'CASH'"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE kas_bank MODIFY COLUMN jenis ENUM("
        "'CASH','BANK_BCA','BANK_MANDIRI','BANK_BRI','BANK_LAINNYA',"
        "'BOP_JASA_ANGKUT_CASH','BOP_JASA_ANGKUT_BCA','BOP_MOBIL_CASH','BOP_MOBIL_BCA',"
        "'KAS_UNIT_BENGKEL','KAS_UNIT_JASA_ANGKUT','KAS_UNIT_MOBIL',"
        "'KAS_UTAMA','BANK_UTAMA') NOT NULL DEFAULT 'CASH'"
    )
