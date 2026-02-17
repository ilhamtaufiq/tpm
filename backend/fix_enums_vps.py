from sqlalchemy import text, inspect
from app.database import SessionLocal

def inspect_and_fix():
    db = SessionLocal()
    print("Inspeksi Mendalam & Perbaikan Enum...")
    
    try:
        inspector = inspect(db.get_bind())
        tables = inspector.get_table_names()
        
        # Kolom target
        enum_cols = ['metode_bayar', 'metode_bayar_beli', 'metode']
        
        for table in tables:
            columns = [c['name'] for c in inspector.get_columns(table)]
            # Cari kolom yang cocok
            found_cols = [c for c in columns if c in enum_cols]
            
            if not found_cols:
                continue
                
            # Ambil Primary Key
            pk_cols = inspector.get_pk_constraint(table)['constrained_columns']
            if not pk_cols:
                print(f"Peringatan: Tabel {table} tidak punya Primary Key. Mencoba cari kolom 'id'...")
                if 'id' in columns:
                    pk_col = 'id'
                else:
                    print(f"Skipping {table} karena tidak ada PK.")
                    continue
            else:
                pk_col = pk_cols[0]

            for column in found_cols:
                print(f"Memproses {table}.{column}...")
                
                # Gunakan query paling dasar untuk mencari data yang mengandung huruf kecil
                # Kita ambil data mentahnya
                raw_sql = text(f"SELECT {pk_col}, {column} FROM {table}")
                rows = db.execute(raw_sql).fetchall()
                
                updated_count = 0
                for pk_val, val in rows:
                    if val and any(c.islower() for c in str(val)):
                        new_val = str(val).upper().strip()
                        # Update secara langsung menggunakan string mentah untuk menghindari masalah Enum MySQL
                        update_sql = text(f"UPDATE {table} SET {column} = :new WHERE {pk_col} = :id")
                        db.execute(update_sql, {"new": new_val, "id": pk_val})
                        updated_count += 1
                
                if updated_count > 0:
                    print(f"  -> Berhasil paksa {updated_count} baris di {table}.{column} menjadi UPPERCASE.")
                
        db.commit()
        print("\nFix Selesai. Mohon jalankan 'sudo systemctl restart tpm-app-backend' sekarang.")

    except Exception as e:
        db.rollback()
        print(f"Kesalahan: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    inspect_and_fix()
