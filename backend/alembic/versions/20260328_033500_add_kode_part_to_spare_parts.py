"""add_kode_part_to_spare_parts

Revision ID: 67ed5a3290f1
Revises: 12c0273dbfc3
Create Date: 2026-03-28 03:35:00.000000+07:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '67ed5a3290f1'
down_revision: Union[str, None] = '12c0273dbfc3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Dapatkan koneksi dan inspektor database untuk pengecekan aman
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    column_names = [c['name'] for c in inspector.get_columns('spare_parts')]
    
    # Tambahkan kolom kode_part jika belum ada
    if 'kode_part' not in column_names:
        op.add_column('spare_parts', sa.Column('kode_part', sa.String(length=50), nullable=True))
        
    # Buat index jika belum ada
    indices = [i['name'] for i in inspector.get_indexes('spare_parts')]
    if 'ix_spare_parts_kode_part' not in indices:
        op.create_index(op.f('ix_spare_parts_kode_part'), 'spare_parts', ['kode_part'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_spare_parts_kode_part'), table_name='spare_parts')
    op.drop_column('spare_parts', 'kode_part')
