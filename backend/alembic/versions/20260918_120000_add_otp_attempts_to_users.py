"""add_login_otps_table

Menggantikan `users.otp_code` / `otp_expires` / `otp_attempts` dengan tabel
`login_otps`: satu baris per kode terbit, sehingga beberapa login bersamaan
untuk user yang sama tidak saling menimpa, dan tiap kode punya sisa percobaan
sendiri. Kode disimpan sebagai HMAC, bukan plaintext.

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-09-18 12:00:00.000000+07:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b8c9d0e1f2a3'
down_revision: Union[str, None] = 'a7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return column in {c["name"] for c in inspector.get_columns(table)}


def upgrade() -> None:
    op.create_table(
        'login_otps',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            'user_id',
            sa.Integer(),
            sa.ForeignKey('users.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('otp_hash', sa.String(length=64), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_login_otps_user_id', 'login_otps', ['user_id'])
    op.create_index('ix_login_otps_otp_hash', 'login_otps', ['otp_hash'])

    # Kolom lama tidak dipakai lagi. `otp_attempts` hanya ada kalau migrasi
    # versi sebelumnya sempat jalan di mesin ini.
    op.drop_column('users', 'otp_code')
    op.drop_column('users', 'otp_expires')
    if _has_column('users', 'otp_attempts'):
        op.drop_column('users', 'otp_attempts')


def downgrade() -> None:
    op.add_column('users', sa.Column('otp_code', sa.String(length=10), nullable=True))
    op.add_column('users', sa.Column('otp_expires', sa.DateTime(), nullable=True))
    op.drop_index('ix_login_otps_otp_hash', table_name='login_otps')
    op.drop_index('ix_login_otps_user_id', table_name='login_otps')
    op.drop_table('login_otps')
