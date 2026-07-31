"""widen_nomor_referensi_to_50

Revision ID: 79faa72b9619
Revises: 20260715_120000
Create Date: 2026-07-31 09:15:02.364862+07:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = '79faa72b9619'
down_revision: Union[str, None] = '20260715_120000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('hutang_usaha', 'nomor_referensi',
               existing_type=mysql.VARCHAR(charset='utf8mb4', collation='utf8mb4_unicode_ci', length=30),
               type_=sa.String(length=50),
               existing_nullable=True)
    op.alter_column('kas_bank', 'nomor_referensi',
               existing_type=mysql.VARCHAR(charset='utf8mb4', collation='utf8mb4_unicode_ci', length=30),
               type_=sa.String(length=50),
               existing_nullable=True)
    op.alter_column('piutang_usaha', 'nomor_referensi',
               existing_type=mysql.VARCHAR(charset='utf8mb4', collation='utf8mb4_unicode_ci', length=30),
               type_=sa.String(length=50),
               existing_nullable=True)


def downgrade() -> None:
    op.alter_column('piutang_usaha', 'nomor_referensi',
               existing_type=sa.String(length=50),
               type_=mysql.VARCHAR(charset='utf8mb4', collation='utf8mb4_unicode_ci', length=30),
               existing_nullable=True)
    op.alter_column('kas_bank', 'nomor_referensi',
               existing_type=sa.String(length=50),
               type_=mysql.VARCHAR(charset='utf8mb4', collation='utf8mb4_unicode_ci', length=30),
               existing_nullable=True)
    op.alter_column('hutang_usaha', 'nomor_referensi',
               existing_type=sa.String(length=50),
               type_=mysql.VARCHAR(charset='utf8mb4', collation='utf8mb4_unicode_ci', length=30),
               existing_nullable=True)
