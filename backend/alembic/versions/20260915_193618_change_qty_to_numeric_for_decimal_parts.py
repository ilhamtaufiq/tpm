"""change qty to numeric for decimal sparepart quantities

Revision ID: f3a4b5c6d7e8
Revises: e2b3c4d5e6f7
Create Date: 2026-09-15 19:36:18.000000+07:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = 'f3a4b5c6d7e8'
down_revision: Union[str, None] = 'e2b3c4d5e6f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Sparepart boleh dijual per pecahan (mis. 0.5 liter oli).
    # Jasa/servis tetap integer.
    op.alter_column('detail_transaksi_spare_parts', 'qty',
               existing_type=mysql.INTEGER(),
               type_=sa.Numeric(precision=15, scale=2),
               existing_nullable=False,
               existing_server_default=None)
    op.alter_column('detail_pembelian_spare_parts', 'qty',
               existing_type=mysql.INTEGER(),
               type_=sa.Numeric(precision=15, scale=2),
               existing_nullable=False,
               existing_server_default=None)


def downgrade() -> None:
    op.alter_column('detail_transaksi_spare_parts', 'qty',
               existing_type=sa.Numeric(precision=15, scale=2),
               type_=mysql.INTEGER(),
               existing_nullable=False)
    op.alter_column('detail_pembelian_spare_parts', 'qty',
               existing_type=sa.Numeric(precision=15, scale=2),
               type_=mysql.INTEGER(),
               existing_nullable=False)
