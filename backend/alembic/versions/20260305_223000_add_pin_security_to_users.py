"""add pin security to users

Revision ID: 202603052230
Revises: f82d3e4c5b6a
Create Date: 2026-03-05 22:30:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '202603052230'
down_revision: Union[str, None] = 'f82d3e4c5b6a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:
    op.add_column('users', sa.Column('hashed_pin', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('security_settings', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'security_settings')
    op.drop_column('users', 'hashed_pin')
