"""add_otp_fields_to_user

Revision ID: e2f3g4h5i6j7
Revises: cd7a80b12345
Create Date: 2026-03-30 00:43:00.000000+07:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2f3g4h5i6j7'
down_revision: Union[str, None] = 'cd7a80b12345'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add otp_code and otp_expires columns to users table
    op.add_column('users', sa.Column('otp_code', sa.String(length=10), nullable=True))
    op.add_column('users', sa.Column('otp_expires', sa.DateTime(), nullable=True))


def downgrade() -> None:
    # Drop otp_code and otp_expires columns from users table
    op.drop_column('users', 'otp_expires')
    op.drop_column('users', 'otp_code')
