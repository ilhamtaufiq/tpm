import mysql.connector
from dotenv import load_dotenv
import os

load_dotenv()

conn = mysql.connector.connect(
    host=os.getenv("DB_HOST", "localhost"),
    user=os.getenv("DB_USER", "root"),
    password=os.getenv("DB_PASSWORD", ""),
    database=os.getenv("DB_NAME", "tpm_db")
)
cursor = conn.cursor()

try:
    print("Migrating piutang_usaha status enum...")
    cursor.execute("ALTER TABLE piutang_usaha MODIFY COLUMN status ENUM('BELUM_LUNAS', 'LUNAS', 'SEBAGIAN', 'BATAL') NOT NULL DEFAULT 'BELUM_LUNAS'")
    
    print("Migrating hutang_usaha status enum...")
    cursor.execute("ALTER TABLE hutang_usaha MODIFY COLUMN status ENUM('BELUM_LUNAS', 'LUNAS', 'SEBAGIAN', 'BATAL') NOT NULL DEFAULT 'BELUM_LUNAS'")
    
    print("Migrating transaksi_penjualan_mobil status_bayar enum...")
    cursor.execute("ALTER TABLE transaksi_penjualan_mobil MODIFY COLUMN status_bayar ENUM('LUNAS', 'BELUM_LUNAS', 'CICILAN', 'BATAL') NOT NULL DEFAULT 'LUNAS'")

    print("Making mobil_id nullable in transaksi_penjualan_mobil...")
    cursor.execute("ALTER TABLE transaksi_penjualan_mobil MODIFY COLUMN mobil_id INT NULL")

    conn.commit()
    print("Successfully updated database schema.")
except Exception as e:
    print(f"Error: {e}")
    conn.rollback()
finally:
    cursor.close()
    conn.close()
