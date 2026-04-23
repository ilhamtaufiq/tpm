import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Add parent directory to path to import app modules if needed
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

load_dotenv()

# Get DB settings from .env
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME", "tpm_db")

# Create connection URL
DB_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(DB_URL)

def migrate():
    print(f"Connecting to {DB_NAME}...")
    
    with engine.connect() as conn:
        # 1. Add 'unit' column to piutang_usaha
        try:
            print("Adding 'unit' column to piutang_usaha...")
            conn.execute(text("ALTER TABLE piutang_usaha ADD COLUMN unit ENUM('BENGKEL', 'JUAL_BELI_MOBIL', 'JASA_ANGKUT', 'PEMBELIAN_PART', 'PEMBELIAN_MOBIL', 'PENGELUARAN', 'GAJI', 'KASBON', 'PIUTANG', 'HUTANG', 'MODAL', 'PRIVE', 'ASET', 'LAINNYA') NULL AFTER sumber"))
            conn.commit()
            print("Successfully added 'unit' to piutang_usaha")
        except Exception as e:
            if "Duplicate column name" in str(e):
                print("'unit' column already exists in piutang_usaha")
            else:
                print(f"Error adding 'unit' to piutang_usaha: {e}")

        # 2. Update 'sumber' enum in piutang_usaha to include LAINNYA
        try:
            print("Updating 'sumber' enum in piutang_usaha...")
            conn.execute(text("ALTER TABLE piutang_usaha MODIFY COLUMN sumber ENUM('BENGKEL', 'JUAL_BELI_MOBIL', 'JASA_ANGKUT', 'KASBON_KARYAWAN', 'LAINNYA') NOT NULL DEFAULT 'BENGKEL'"))
            conn.commit()
            print("Successfully updated 'sumber' enum in piutang_usaha")
        except Exception as e:
            print(f"Error updating 'sumber' enum in piutang_usaha: {e}")

        # 3. Add 'unit' column to hutang_usaha
        try:
            print("Adding 'unit' column to hutang_usaha...")
            conn.execute(text("ALTER TABLE hutang_usaha ADD COLUMN unit ENUM('BENGKEL', 'JUAL_BELI_MOBIL', 'JASA_ANGKUT', 'PEMBELIAN_PART', 'PEMBELIAN_MOBIL', 'PENGELUARAN', 'GAJI', 'KASBON', 'PIUTANG', 'HUTANG', 'MODAL', 'PRIVE', 'ASET', 'LAINNYA') NULL AFTER nomor_referensi"))
            conn.commit()
            print("Successfully added 'unit' to hutang_usaha")
        except Exception as e:
            if "Duplicate column name" in str(e):
                print("'unit' column already exists in hutang_usaha")
            else:
                print(f"Error adding 'unit' to hutang_usaha: {e}")

        # 4. Add 'unit' column to kasbon_karyawan
        try:
            print("Adding 'unit' column to kasbon_karyawan...")
            conn.execute(text("ALTER TABLE kasbon_karyawan ADD COLUMN unit ENUM('BENGKEL', 'JUAL_BELI_MOBIL', 'JASA_ANGKUT', 'PEMBELIAN_PART', 'PEMBELIAN_MOBIL', 'PENGELUARAN', 'GAJI', 'KASBON', 'PIUTANG', 'HUTANG', 'MODAL', 'PRIVE', 'ASET', 'LAINNYA') NOT NULL DEFAULT 'BENGKEL' AFTER keterangan"))
            conn.commit()
            print("Successfully added 'unit' to kasbon_karyawan")
        except Exception as e:
            if "Duplicate column name" in str(e):
                print("'unit' column already exists in kasbon_karyawan")
            else:
                print(f"Error adding 'unit' to kasbon_karyawan: {e}")

    print("Migration finished!")

if __name__ == "__main__":
    migrate()
