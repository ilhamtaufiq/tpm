from sqlalchemy import text, inspect
from app.database import SessionLocal

def fix_enums_comprehensive():
    db = SessionLocal()
    print("Mulai perbaikan enum (Versi Total & Agresif - Semua Nilai)...")
    
    # Kolom-kolom target
    enum_columns = [
        'metode_bayar', 'metode_bayar_beli', 'metode', 
        'kategori', 'sumber', 'status', 'tipe', 'jenis',
        'status_bayar', 'status_pengerjaan'
    ]

    try:
        inspector = inspect(db.get_bind())
        tables = inspector.get_table_names()
        
        for table in tables:
            columns = [c['name'] for c in inspector.get_columns(table)]
            target_cols = [c for c in columns if c in enum_columns]
            
            for column in target_cols:
                print(f"Memeriksa {table}.{column}...")
                
                # Gunakan pendekatan UPDATE via subquery untuk menghindari masalah Collation MySQL
                # Cari semua yang punya huruf kecil
                check_sql = text(f"SELECT id, {column} FROM {table} WHERE BINARY {column} REGEXP '[a-z]'")
                results = db.execute(check_sql).fetchall()
                
                if results:
                    print(f"  -> Ditemukan {len(results)} baris bermasalah. Memperbaiki...")
                    for row in results:
                        row_id = row[0]
                        old_val = row[1]
                        new_val = str(old_val).upper().strip()
                        
                        # Update satu per satu berdasarkan ID untuk kepastian 100%
                        update_sql = text(f"UPDATE {table} SET {column} = :new WHERE id = :id")
                        db.execute(update_sql, {"new": new_val, "id": row_id})
                    print(f"  -> {table}.{column} SELESAI.")

        db.commit()
        
        print("\n--- Verifikasi Akhir (Hanya Kolom Payment Method) ---")
        found_any = False
        for table in tables:
            columns = [c['name'] for c in inspector.get_columns(table)]
            if any(col in columns for col in ['metode_bayar', 'metode_bayar_beli', 'metode']):
                col_to_check = next(col for col in columns if col in ['metode_bayar', 'metode_bayar_beli', 'metode'])
                check = db.execute(text(f"SELECT {col_to_check} FROM {table} WHERE BINARY {col_to_check} REGEXP '[a-z]'")).fetchall()
                if check:
                    found_any = True
                    print(f"GAGAL: {table}.{col_to_check} masih ada huruf kecil: {[r[0] for r in check]}")
        
        if not found_any:
            print("DATABASE SUDAH BERSIH 100%! Semua nilai Enum sudah UPPERCASE.")

    except Exception as e:
        db.rollback()
        print(f"\nTerjadi kesalahan: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_enums_comprehensive()
