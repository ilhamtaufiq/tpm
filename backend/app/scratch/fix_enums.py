import MySQLdb
import sys

def update_db():
    try:
        # Database connection settings from app/config.py
        db = MySQLdb.connect(
            host="localhost",
            user="root",
            passwd="",
            db="tpm_db"
        )
        cursor = db.cursor()
        
        print("Updating muatan_jasa_angkut.status...")
        cursor.execute("ALTER TABLE muatan_jasa_angkut MODIFY COLUMN status ENUM('PROSES', 'SELESAI', 'BATAL') NOT NULL DEFAULT 'PROSES'")
        
        print("Updating muatan_jasa_angkut.status_bayar...")
        cursor.execute("ALTER TABLE muatan_jasa_angkut MODIFY COLUMN status_bayar ENUM('LUNAS', 'BELUM_LUNAS', 'CICILAN', 'BATAL') NOT NULL DEFAULT 'BELUM_LUNAS'")
        
        db.commit()
        print("Success: Database enums updated for BATAL status.")
        
    except Exception as e:
        print(f"Error updating database: {e}")
        sys.exit(1)

if __name__ == "__main__":
    update_db()
