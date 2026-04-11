import sys
import os

# Setup path agar bisa import dari app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import inspect, text
from app.database.connection import engine, SessionLocal

def reset_database():
    print("="*60)
    print("!  BAHAYA: RESET DATABASE")
    print("="*60)
    print("Script ini akan MENGHAPUS SEMUA DATA di semua tabel,")
    print("KECUALI tabel 'users' dan tabel sistem 'alembic_version'.")
    print("\nPeringatan: Data yang terhapus tidak dapat dikembalikan!")
    
    confirm = input("\nKetik 'RESET' untuk melanjutkan: ")
    if confirm != 'RESET':
        print("Proses dibatalkan.")
        return

    db = SessionLocal()
    try:
        inspector = inspect(engine)
        table_names = inspector.get_table_names()
        
        # Tabel yang tidak boleh dihapus datanya
        excluded_tables = {'users', 'alembic_version'}
        
        tables_to_truncate = [t for t in table_names if t not in excluded_tables]
        
        if not tables_to_truncate:
            print("Tidak ada tabel untuk di-reset.")
            return
            
        print(f"\nMulai me-reset {len(tables_to_truncate)} tabel...\n")
        
        # Disable foreign key checks sementara agar bisa TRUNCATE tabel yang berelasi (untuk MySQL)
        db.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
        
        for table in tables_to_truncate:
            print(f"Kosongkan tabel: {table} ...")
            db.execute(text(f"TRUNCATE TABLE `{table}`;"))
            
        # Kembalikan foreign key checks
        db.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
        
        db.commit()
        print("\n[OK] Reset database berhasil! Semua data selain users telah dikosongkan.")
        
    except Exception as e:
        db.rollback()
        # Jika terjadi error saat mematikan foreign keys, pastikan untuk menghidupkannya kembali
        try:
            db.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
            db.commit()
        except:
            pass
        print(f"\n[ERROR] Terjadi kesalahan: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    reset_database()
