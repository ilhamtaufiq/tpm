import os
from sqlalchemy import create_engine, inspect
from dotenv import load_dotenv

load_dotenv()
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_NAME = os.getenv("DB_NAME", "tpm_db")

# Using mysqlclient (mysql://)
DATABASE_URL = f"mysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}"

engine = create_engine(DATABASE_URL)
inspector = inspect(engine)

def check_table(table_name):
    print(f"\nChecking table: {table_name}")
    try:
        columns = inspector.get_columns(table_name)
        for column in columns:
            print(f"  Column: {column['name']}, Type: {column['type']}")
    except Exception as e:
        print(f"  Error: {e}")

if __name__ == "__main__":
    check_table("absensi")
