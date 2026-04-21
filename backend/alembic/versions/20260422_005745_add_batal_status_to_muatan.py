"""add_batal_status_to_muatan

Revision ID: 8482a6eeaebf
Revises: b73b3ba981f0
Create Date: 2026-04-22 00:57:45.220909+07:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8482a6eeaebf'
down_revision: Union[str, None] = 'b73b3ba981f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Update muatan_jasa_angkut status enum
    op.execute("ALTER TABLE muatan_jasa_angkut MODIFY COLUMN status ENUM('PROSES', 'SELESAI', 'BATAL') NOT NULL DEFAULT 'PROSES'")
    
    # 2. Update muatan_jasa_angkut status_bayar enum
    op.execute("ALTER TABLE muatan_jasa_angkut MODIFY COLUMN status_bayar ENUM('LUNAS', 'BELUM_LUNAS', 'CICILAN', 'BATAL') NOT NULL DEFAULT 'BELUM_LUNAS'")


def downgrade() -> None:
    # Reverting enums - note: this may fail if data with 'BATAL' value exists
    op.execute("ALTER TABLE muatan_jasa_angkut MODIFY COLUMN status ENUM('PROSES', 'SELESAI') NOT NULL DEFAULT 'PROSES'")
    op.execute("ALTER TABLE muatan_jasa_angkut MODIFY COLUMN status_bayar ENUM('LUNAS', 'BELUM_LUNAS', 'CICILAN') NOT NULL DEFAULT 'BELUM_LUNAS'")
