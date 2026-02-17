from sqlalchemy import text, inspect
from app.database import SessionLocal

def fix_enums():
    db = SessionLocal()
    print("Mulai perbaikan enum di database (Metode Paksa/Binary)...")
    
    # Daftar nilai yang bermasalah (tambah jika ada yang lain)
    mapping = {
        'transfer': 'TRANSFER',
        'tunai': 'TUNAI',
        'kredit': 'KREDIT',
        'debit': 'DEBIT',
        'split': 'SPLIT',
        'internal': 'INTERNAL'
    }
    
    try:
        inspector = inspect(db.get_bind())
        tables = inspector.get_table_names()
        
        for table in tables:
            columns = [c['name'] for c in inspector.get_columns(table)]
            target_cols = [c for c in columns if c in ['metode_bayar', 'metode_bayar_beli', 'metode']]
            
            for column in target_cols:
                for old_val, new_val in mapping.items():
                    # Gunakan BINARY agar MySQL membedakan huruf besar dan kecil saat update
                    sql = text(f"UPDATE {table} SET {column} = :new WHERE BINARY {column} = :old")
                    result = db.execute(sql, {"new": new_val, "old": old_val})
                    if result.rowcount > 0:
                        print(f"[{table}.{column}] Berhasil paksa '{old_val}' -> '{new_val}' ({result.rowcount} baris)")
            
        db.commit()
        print("\n--- Verifikasi Akhir ---")
        for table in tables:
            columns = [c['name'] for c in inspector.get_columns(table)]
            if 'metode_bayar' in columns:
                # Cek apakah masih ada string dengan huruf kecil manapun
                sql = text(f"SELECT {column} FROM {table} WHERE BINARY {column} REGEXP '[a-z]'")
                results = db.execute(sql).fetchall()
                if results:
                    print(f"PERINGATAN: Masih ada {len(results)} baris mengandung huruf kecil di {table}!")
                else:
                    print(f"{table} BERSIH (OK)")

    except Exception as e:
        db.rollback()
        print(f"\nTerjadi kesalahan fatal: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_enums()
