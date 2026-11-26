"""slip gaji: lepas unique (karyawan, minggu, tahun); periode mengikuti tanggal

Revision ID: c4e6a8b0d2f4
Revises: b3d5f7a9c1e2
Create Date: 2026-11-26 13:00:00.000000+07:00

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c4e6a8b0d2f4'
down_revision: Union[str, None] = 'b3d5f7a9c1e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Periode slip ditentukan rentang tanggal (cek tumpang tindih di service).
    # Unique (karyawan, minggu, tahun) memblokir slip rentang tanggal yang kebetulan
    # berada di minggu ISO yang sama.
    op.drop_constraint('uq_slip_gaji_karyawan_periode', 'slip_gaji', type_='unique')


def downgrade() -> None:
    op.create_unique_constraint('uq_slip_gaji_karyawan_periode', 'slip_gaji', ['karyawan_id', 'periode_minggu', 'periode_tahun'])
