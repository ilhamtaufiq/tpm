"""add is_qty_correction to spare_part_revaluation

Pembeda revaluasi harga beli (price change) vs koreksi stok (qty correction).
Neraca mengabaikan qty correction, modal_service memakai semua.

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-09-23 12:00:00.000000+07:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c9d0e1f2a3b4'
down_revision: Union[str, None] = 'b8c9d0e1f2a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return column in {c["name"] for c in inspector.get_columns(table)}


def upgrade() -> None:
    if not _has_column('spare_part_revaluation', 'is_qty_correction'):
        op.add_column(
            'spare_part_revaluation',
            sa.Column('is_qty_correction', sa.Boolean(), nullable=False, server_default='0'),
        )

    # Insert qty correction untuk part 469 (stok fix 7→6, harga_beli 25.000).
    op.execute(
        sa.text(
            "INSERT INTO spare_part_revaluation "
            "(spare_part_id, pembelian_id, tanggal, qty_at_reval, harga_lama, harga_baru, "
            " amount, is_qty_correction, created_at, updated_at) "
            "SELECT 469, NULL, CURDATE(), sp.stok, sp.harga_beli, sp.harga_beli, "
            " -25000.00, 1, NOW(), NOW() "
            "FROM spare_parts sp "
            "WHERE sp.id = 469 "
            "AND NOT EXISTS ("
            "  SELECT 1 FROM spare_part_revaluation r "
            "  WHERE r.spare_part_id = 469 AND r.is_qty_correction = 1"
            ")"
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "DELETE FROM spare_part_revaluation "
            "WHERE spare_part_id = 469 AND is_qty_correction = 1"
        )
    )
    if _has_column('spare_part_revaluation', 'is_qty_correction'):
        op.drop_column('spare_part_revaluation', 'is_qty_correction')
