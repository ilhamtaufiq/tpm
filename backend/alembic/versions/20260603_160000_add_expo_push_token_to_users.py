"""add_expo_push_token_to_users

Revision ID: 20260603_160000
Revises: 20260505_224700
Create Date: 2026-06-03 16:00:00.000000+07:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260603_160000'
down_revision: Union[str, None] = '20260505_224700'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('expo_push_token', sa.String(length=255), nullable=True))
    op.create_index('ix_users_expo_push_token', 'users', ['expo_push_token'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_users_expo_push_token', table_name='users')
    op.drop_column('users', 'expo_push_token')
