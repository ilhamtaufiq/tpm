from app.database.connection import engine
from sqlalchemy import text

with engine.connect() as conn:
    print("Updating users.role ENUM in database...")
    try:
        # All roles that should be in the ENUM
        roles = "'ADMIN','MANAGER','KASIR','MEKANIK','STAFF','VIEWER','BENGKEL','JASA_ANGKUT','MOBIL'"
        
        # MySQL ALTER TABLE to modify ENUM column
        sql = f"ALTER TABLE users MODIFY COLUMN role ENUM({roles}) NOT NULL DEFAULT 'STAFF'"
        conn.execute(text(sql))
        conn.commit()
        print("Success! UserRole enum updated in database.")
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
