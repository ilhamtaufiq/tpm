"""add client_logs table

Persistent storage untuk log lag/bug/error dari client Android & Web.
Sebelumnya cuma di memori (deque) — hilang tiap server restart.

Revision ID: d1e2f3a4b5c6
Revises: c9d0e1f2a3b4
Create Date: 2026-09-23 13:00:00.000000+07:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, None] = 'c9d0e1f2a3b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'client_logs',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('type', sa.String(20), nullable=False, server_default='ERROR'),
        sa.Column('title', sa.String(255), nullable=False, server_default='Client Event'),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('platform', sa.String(20), nullable=False, server_default='android'),
        sa.Column('duration', sa.Float(), nullable=True),
        sa.Column('status', sa.Integer(), nullable=True),
        sa.Column('stack', sa.Text(), nullable=True),
        sa.Column('url', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_client_logs_type', 'client_logs', ['type'])
    op.create_index('ix_client_logs_platform', 'client_logs', ['platform'])


def downgrade() -> None:
    op.drop_index('ix_client_logs_platform', table_name='client_logs')
    op.drop_index('ix_client_logs_type', table_name='client_logs')
    op.drop_table('client_logs')
