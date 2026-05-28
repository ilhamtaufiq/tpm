import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_NAME = os.getenv("DB_NAME", "tpm_db")

DATABASE_URL = f"mysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}"
engine = create_engine(DATABASE_URL)

def get_enum_values():
    with engine.connect() as conn:
        result = conn.execute(text("SHOW COLUMNS FROM absensi LIKE 'status'"))
        row = result.fetchone()
        if row:
            print(f"Column: {row[0]}")
            print(f"Type: {row[1]}")
        else:
            print("Column not found")

if __name__ == "__main__":
    get_enum_values()
