"""change_system_setting_value_to_longtext

Revision ID: b73b3ba981f0
Revises: 323b00c8baff
Create Date: 2026-04-16 14:03:16.692669+07:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = 'b73b3ba981f0'
down_revision: Union[str, None] = '323b00c8baff'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('system_settings', 'value',
               existing_type=sa.Text(),
               type_=mysql.LONGTEXT(),
               existing_nullable=True)


def downgrade() -> None:
    op.alter_column('system_settings', 'value',
               existing_type=mysql.LONGTEXT(),
               type_=sa.Text(),
               existing_nullable=True)
