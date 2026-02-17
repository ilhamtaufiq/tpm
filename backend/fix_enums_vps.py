from sqlalchemy import text, inspect
from app.database import SessionLocal

def fix_enums():
    db = SessionLocal()
    print("Mulai perbaikan enum (Versi Auto-Uppercase)...")
    
    try:
        inspector = inspect(db.get_bind())
        tables = inspector.get_table_names()
        
        # Kolom-kolom yang biasanya bertipe Enum
        enum_columns = [
            'metode_bayar', 'metode_bayar_beli', 'metode', 
            'kategori', 'sumber', 'status', 'tipe', 'jenis',
            'status_bayar', 'status_pengerjaan'
        ]
        
        for table in tables:
            columns = [c['name'] for c in inspector.get_columns(table)]
            target_cols = [c for c in columns if c in enum_columns]
            
            for column in target_cols:
                # Cari nilai yang mengandung huruf kecil (a-z) menggunakan REGEXP BINARY
                # Lalu paksa semuanya menjadi UPPER dan TRIM (hapus spasi)
                sql = text(f"""
                    UPDATE {table} 
                    SET {column} = UPPER(TRIM({column})) 
                    WHERE BINARY {column} REGEXP '[a-z]'
                """)
                result = db.execute(sql)
                if result.rowcount > 0:
                    print(f"[{table}.{column}] Berhasil mengeperkas {result.rowcount} baris yang mengandung huruf kecil.")
            
        db.commit()
        
        print("\n--- Verifikasi Akhir ---")
        found_any = False
        for table in tables:
            columns = [c['name'] for c in inspector.get_columns(table)]
            target_cols = [c for c in columns if c in enum_columns]
            for column in target_cols:
                check_sql = text(f"SELECT {column} FROM {table} WHERE BINARY {column} REGEXP '[a-z]' LIMIT 5")
                offenders = db.execute(check_sql).fetchall()
                if offenders:
                    found_any = True
                    print(f"PERINGATAN: Di {table}.{column} masih ada: {[r[0] for r in offenders]}")
        
        if not found_any:
            print("DATABASE BERSIH! Semua nilai Enum sudah huruf besar.")

    except Exception as e:
        db.rollback()
        print(f"\nTerjadi kesalahan: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_enums()
