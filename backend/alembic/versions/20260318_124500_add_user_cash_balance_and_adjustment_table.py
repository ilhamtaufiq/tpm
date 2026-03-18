"""add user cash balance and adjustment table

Revision ID: f4b8c9d0e1f2
Revises: ae145223e221
Create Date: 2026-03-18 12:45:00.000000+07:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4b8c9d0e1f2'
down_revision: Union[str, None] = 'ae145223e221'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add cash_balance to users table
    op.add_column('users', sa.Column('cash_balance', sa.Numeric(precision=15, scale=2), nullable=False, server_default='0.00'))
    
    # Create user_cash_adjustments table
    op.create_table('user_cash_adjustments',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('admin_id', sa.Integer(), nullable=False),
        sa.Column('saldo_sebelum', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('saldo_sesudah', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('nominal', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('keterangan', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['admin_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_cash_adjustments_admin_id'), 'user_cash_adjustments', ['admin_id'], unique=False)
    op.create_index(op.f('ix_user_cash_adjustments_user_id'), 'user_cash_adjustments', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_user_cash_adjustments_user_id'), table_name='user_cash_adjustments')
    op.drop_index(op.f('ix_user_cash_adjustments_admin_id'), table_name='user_cash_adjustments')
    op.drop_table('user_cash_adjustments')
    op.drop_column('users', 'cash_balance')
