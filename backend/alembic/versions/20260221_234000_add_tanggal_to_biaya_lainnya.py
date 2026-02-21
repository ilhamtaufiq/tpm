"""add_tanggal_to_biaya_lainnya

Revision ID: a1b2c3d4e5f6
Revises: 6fee9131b52f
Create Date: 2026-02-21 23:40:00.000000+07:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '6fee9131b52f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add tanggal column to jasa_angkut_biaya_lainnya
    # This column was defined in the SQLAlchemy model but never migrated
    op.add_column('jasa_angkut_biaya_lainnya', sa.Column('tanggal', sa.Date(), nullable=True))
    op.create_index(op.f('ix_jasa_angkut_biaya_lainnya_tanggal'), 'jasa_angkut_biaya_lainnya', ['tanggal'], unique=False)
    
    # Backfill tanggal from the linked muatan_jasa_angkut record
    # For records that have a muatan_id, set tanggal = muatan.tanggal
    op.execute("""
        UPDATE jasa_angkut_biaya_lainnya b
        JOIN muatan_jasa_angkut m ON b.muatan_id = m.id
        SET b.tanggal = m.tanggal
        WHERE b.muatan_id IS NOT NULL AND b.tanggal IS NULL
    """)
    
    # For standalone armada expenses without muatan, set tanggal from created_at
    op.execute("""
        UPDATE jasa_angkut_biaya_lainnya
        SET tanggal = DATE(created_at)
        WHERE muatan_id IS NULL AND tanggal IS NULL
    """)


def downgrade() -> None:
    op.drop_index(op.f('ix_jasa_angkut_biaya_lainnya_tanggal'), table_name='jasa_angkut_biaya_lainnya')
    op.drop_column('jasa_angkut_biaya_lainnya', 'tanggal')
