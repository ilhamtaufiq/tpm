from sqlalchemy import text, inspect
from app.database import SessionLocal

def fix_enums():
    db = SessionLocal()
    
    print("Mulai perbaikan enum di database (Lebih Agresif)...")
    
    try:
        # Ambil daftar semua tabel
        inspector = inspect(db.get_bind())
        tables = inspector.get_table_names()
        
        for table in tables:
            columns = [c['name'] for c in inspector.get_columns(table)]
            
            # Cari kolom yang berhubungan dengan metode bayar
            target_cols = [c for c in columns if c in ['metode_bayar', 'metode_bayar_beli', 'metode']]
            
            for column in target_cols:
                print(f"Mengupdate {table}.{column} menjadi UPPERCASE...")
                # Update semua nilai menjadi UPPERCASE
                # Gunakan BINARY atau casting jika perlu, tapi biasanya SQL UPPER() cukup
                sql = text(f"UPDATE {table} SET {column} = UPPER({column}) WHERE {column} IS NOT NULL")
                result = db.execute(sql)
                if result.rowcount > 0:
                    print(f"  -> Berhasil mengupdate {result.rowcount} baris.")
            
            # Khusus untuk tabel pengeluaran yang tadi error
            if table == "pengeluaran_bengkel":
                 print(f"Memastikan pengeluaran_bengkel.metode_bayar bersih...")
                 sql = text("UPDATE pengeluaran_bengkel SET metode_bayar = UPPER(metode_bayar)")
                 db.execute(sql)

        db.commit()
        print("\nSemua data di semua tabel berhasil diperbaiki menjadi HURUF BESAR.")
        
        # Tambahan: Cek apakah ada nilai 'transfer' yang tersisa
        for table in tables:
             columns = [c['name'] for c in inspector.get_columns(table)]
             if 'metode_bayar' in columns:
                 sql = text(f"SELECT COUNT(*) FROM {table} WHERE metode_bayar = 'transfer'")
                 count = db.execute(sql).scalar()
                 if count > 0:
                     print(f"PERINGATAN: Masih ada {count} baris 'transfer' di {table}!")

    except Exception as e:
        db.rollback()
        print(f"\nTerjadi kesalahan: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_enums()
