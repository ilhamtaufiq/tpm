import sys
import os
# Add current directory to sys.path
sys.path.append(os.getcwd())

try:
    from alembic.config import Config
    from alembic import command
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")
    print("Migration successful")
except Exception as e:
    print(f"Migration failed: {e}")
    sys.exit(1)
