"""add kode_ean to spare_parts

Revision ID: 20260707_120000
Revises: 20260706_120000
Create Date: 2026-07-07 12:00:00.000000+07:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260707_120000"
down_revision: Union[str, None] = "20260706_120000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    column_names = [c["name"] for c in inspector.get_columns("spare_parts")]

    if "kode_ean" not in column_names:
        op.add_column("spare_parts", sa.Column("kode_ean", sa.String(length=20), nullable=True))

    indices = [i["name"] for i in inspector.get_indexes("spare_parts")]
    if "ix_spare_parts_kode_ean" not in indices:
        op.create_index(op.f("ix_spare_parts_kode_ean"), "spare_parts", ["kode_ean"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_spare_parts_kode_ean"), table_name="spare_parts")
    op.drop_column("spare_parts", "kode_ean")