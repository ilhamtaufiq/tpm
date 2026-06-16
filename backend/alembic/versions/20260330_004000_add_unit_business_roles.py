"""add_unit_business_roles

Revision ID: cd7a80b12345
Revises: 5ecd2a974e47
Create Date: 2026-03-30 00:40:00.000000+07:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cd7a80b12345'
down_revision: Union[str, None] = '5ecd2a974e47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # All roles that should be in the ENUM
    roles = "'ADMIN','MANAGER','KASIR','MEKANIK','STAFF','VIEWER','BENGKEL','JASA_ANGKUT','MOBIL'"
    
    # MySQL ALTER TABLE to modify ENUM column
    op.execute(
        f"ALTER TABLE users MODIFY COLUMN role ENUM({roles}) NOT NULL DEFAULT 'STAFF'"
    )


def downgrade() -> None:
    # Revert to previous enum (without new business units)
    # Note: KASIR and MEKANIK are included here as they were in the codebase constants previously
    old_roles = "'ADMIN','MANAGER','KASIR','MEKANIK','STAFF','VIEWER'"
    op.execute(
        f"ALTER TABLE users MODIFY COLUMN role ENUM({old_roles}) NOT NULL DEFAULT 'STAFF'"
    )
