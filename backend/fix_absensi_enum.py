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

def fix_enum():
    sql = "ALTER TABLE absensi MODIFY COLUMN status ENUM('HADIR','IZIN','SAKIT','ALPHA','CUTI','SETENGAH_HARI') DEFAULT 'HADIR';"
    print("Executing: " + sql)
    try:
        with engine.connect() as conn:
            conn.execute(text(sql))
            conn.commit()
            print("Successfully updated ENUM values.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fix_enum()
