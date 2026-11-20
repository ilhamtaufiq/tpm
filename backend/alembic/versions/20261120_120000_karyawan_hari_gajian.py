"""karyawan: hari gajian (SABTU / KAMIS) untuk periode slip gaji

Revision ID: a7c1e2d4f6b8
Revises: e5f7a9b1c3d4
Create Date: 2026-11-20 12:00:00.000000+07:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a7c1e2d4f6b8'
down_revision: Union[str, None] = 'e5f7a9b1c3d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'karyawan',
        sa.Column('hari_gajian', sa.String(length=10), nullable=False, server_default='SABTU'),
    )


def downgrade() -> None:
    op.drop_column('karyawan', 'hari_gajian')
