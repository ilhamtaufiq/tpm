"""struk digital piutang dan hutang: token publik

Revision ID: e5f7a9b1c3d4
Revises: d4e6f8a0b2c3
Create Date: 2026-10-30 12:00:00.000000+07:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'e5f7a9b1c3d4'
down_revision: Union[str, None] = 'd4e6f8a0b2c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('piutang_usaha', sa.Column('public_receipt_token', sa.String(length=64), nullable=True))
    op.create_index('ix_piutang_usaha_public_receipt_token', 'piutang_usaha', ['public_receipt_token'], unique=True)
    op.add_column('hutang_usaha', sa.Column('public_receipt_token', sa.String(length=64), nullable=True))
    op.create_index('ix_hutang_usaha_public_receipt_token', 'hutang_usaha', ['public_receipt_token'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_hutang_usaha_public_receipt_token', table_name='hutang_usaha')
    op.drop_column('hutang_usaha', 'public_receipt_token')
    op.drop_index('ix_piutang_usaha_public_receipt_token', table_name='piutang_usaha')
    op.drop_column('piutang_usaha', 'public_receipt_token')
