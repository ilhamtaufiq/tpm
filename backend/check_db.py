
import sys
import os
from sqlalchemy import create_engine, text

# Add the parent directory to sys.path to allow imports from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings

# Database connection
DATABASE_URL = settings.database_url
print(f"Connecting to database: {DATABASE_URL}")

engine = create_engine(DATABASE_URL)

def check_db_content():
    with engine.connect() as connection:
        try:
            # Describe table
            print("\nTable Structure:")
            result = connection.execute(text("DESCRIBE pengeluaran_bengkel"))
            for row in result:
                print(row)

            # Get Rows
            print("\nTable Content:")
            result = connection.execute(text("SELECT * FROM pengeluaran_bengkel"))
            columns = result.keys()
            print(f"Columns: {columns}")
            rows = result.fetchall()
            print(f"Found {len(rows)} rows.")
            for row in rows:
                print(row)
        except Exception as e:
            print(f"Error checking DB: {e}")

if __name__ == "__main__":
    check_db_content()
