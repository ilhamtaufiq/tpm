"""add SETENGAH_HARI to absensi.status enum; slip_gaji.jumlah_hadir ke DECIMAL(5,1)

Model AttendanceStatus sudah punya SETENGAH_HARI (dipakai akrual gaji), tapi
kolom MySQL absensi.status masih ENUM lama tanpa nilai itu sehingga insert
absensi setengah hari gagal (Data truncated).
slip_gaji.jumlah_hadir di DB masih INT (model Numeric(5,1)), sehingga 0.5 hari
terbulatkan ke bilangan bulat.

Revision ID: f1a2b3c4d5e6
Revises: e5f6a7b8c9d0
Create Date: 2026-10-08 12:00:00.000000+07:00

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FULL_ENUM = "'HADIR','IZIN','SAKIT','ALPHA','CUTI','SETENGAH_HARI'"


def upgrade() -> None:
    op.execute(
        f"ALTER TABLE absensi "
        f"MODIFY COLUMN status ENUM({FULL_ENUM}) NOT NULL DEFAULT 'HADIR'"
    )
    op.execute(
        "ALTER TABLE slip_gaji "
        "MODIFY COLUMN jumlah_hadir DECIMAL(5,1) NOT NULL DEFAULT 0"
    )


def downgrade() -> None:
    # Tidak menghapus nilai enum: baris SETENGAH_HARI yang sudah ada akan hilang/rusak.
    pass
