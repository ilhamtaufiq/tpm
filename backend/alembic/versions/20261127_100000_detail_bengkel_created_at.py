"""detail bengkel: tanggal input part dan jasa (created_at)

Data lama diisi dari created_at nota induknya (perkiraan: item lama tidak punya
catatan waktu). Baris baru memakai waktu saat disimpan.

Revision ID: d5f7a9c1e3b5
Revises: c4e6a8b0d2f4
Create Date: 2026-11-27 10:00:00.000000+07:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'd5f7a9c1e3b5'
down_revision: Union[str, None] = 'c4e6a8b0d2f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for tabel in ('detail_transaksi_spare_parts', 'detail_transaksi_services'):
        op.add_column(tabel, sa.Column('created_at', sa.DateTime(), nullable=True))
        op.execute(
            f"UPDATE {tabel} d JOIN transaksi_penjualan_bengkel t ON t.id = d.transaksi_id "
            f"SET d.created_at = t.created_at WHERE d.created_at IS NULL"
        )
        op.execute(f"UPDATE {tabel} SET created_at = NOW() WHERE created_at IS NULL")
        op.alter_column(tabel, 'created_at', existing_type=sa.DateTime(), nullable=False,
                        server_default=sa.text('CURRENT_TIMESTAMP'))


def downgrade() -> None:
    op.drop_column('detail_transaksi_services', 'created_at')
    op.drop_column('detail_transaksi_spare_parts', 'created_at')
