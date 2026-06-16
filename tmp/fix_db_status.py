from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()

DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_NAME = os.getenv("DB_NAME", "tpm_db")

DATABASE_URL = f"mysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}"
engine = create_engine(DATABASE_URL)

def fix_db():
    queries = [
        "ALTER TABLE muatan_jasa_angkut ADD COLUMN if not exists status VARCHAR(20) DEFAULT 'PROSES' AFTER laba_supir;",
        "UPDATE muatan_jasa_angkut SET status = 'SELESAI' WHERE status_bayar = 'LUNAS';",
        "CREATE INDEX idx_muatan_status ON muatan_jasa_angkut(status);"
    ]
    
    with engine.connect() as conn:
        for query in queries:
            try:
                print(f"Executing: {query}")
                conn.execute(text(query))
                conn.commit()
                print("Success")
            except Exception as e:
                print(f"Error: {e}")

if __name__ == "__main__":
    fix_db()
