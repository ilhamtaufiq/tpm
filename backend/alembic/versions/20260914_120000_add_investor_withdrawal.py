"""add_investor_withdrawal

Revision ID: e2b3c4d5e6f7
Revises: d1a2b3c4d5e6
Create Date: 2026-09-14 12:00:00.000000+07:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e2b3c4d5e6f7'
down_revision: Union[str, None] = 'd1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'investor_withdrawal',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('mobil_id', sa.Integer(), nullable=False),
        sa.Column('tanggal', sa.Date(), nullable=False),
        sa.Column('nominal', sa.Numeric(15, 2), nullable=False),
        sa.Column('metode_bayar', sa.Enum(
            'TUNAI', 'TRANSFER', 'KREDIT', 'DEBIT', 'SPLIT', 'INTERNAL', 'POTONG_GAJI', 'OTHER',
            name='paymentmethod',
        ), nullable=False),
        sa.Column('catatan', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['mobil_id'], ['mobil.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_investor_withdrawal_mobil_id'),
        'investor_withdrawal', ['mobil_id'], unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_investor_withdrawal_mobil_id'), table_name='investor_withdrawal')
    op.drop_table('investor_withdrawal')
