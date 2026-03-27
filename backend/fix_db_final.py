from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

# Force load from .env in current directory
load_dotenv(".env")

DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_NAME = os.getenv("DB_NAME", "tpm_db")

# Use pymysql or similar if needed, but MySQLdb is preferred if available
# The error says MySQLdb is being used by the app.
DATABASE_URL = f"mysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}"
print(f"Connecting to: mysql://{DB_USER}:***@{DB_HOST}/{DB_NAME}")

engine = create_engine(DATABASE_URL)

def fix_db():
    # Check if column exists first
    check_query = f"SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'muatan_jasa_angkut' AND COLUMN_NAME = 'status' AND TABLE_SCHEMA = '{DB_NAME}'"
    
    with engine.connect() as conn:
        result = conn.execute(text(check_query)).fetchone()
        if result:
            print("Column 'status' already exists.")
        else:
            print("Column 'status' missing. Adding it...")
            add_query = "ALTER TABLE muatan_jasa_angkut ADD COLUMN status VARCHAR(20) DEFAULT 'PROSES' AFTER laba_supir"
            conn.execute(text(add_query))
            conn.execute(text("UPDATE muatan_jasa_angkut SET status = 'SELESAI' WHERE status_bayar = 'LUNAS'"))
            conn.execute(text("CREATE INDEX idx_muatan_status ON muatan_jasa_angkut(status)"))
            conn.commit()
            print("Successfully added 'status' column and index.")

if __name__ == "__main__":
    try:
        fix_db()
    except Exception as e:
        print(f"Error: {e}")
