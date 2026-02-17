from sqlalchemy import text, inspect
from app.database import SessionLocal

def fix_enums_atomic():
    db = SessionLocal()
    print("Mulai perbaikan enum (Versi Atomik/Manual Override)...")
    
    try:
        # 1. Paksa tabel pengeluaran_bengkel yang membandel
        print("Menargetkan pengeluaran_bengkel.metode_bayar secara spesifik...")
        # Kita gunakan casting ke CHAR lalu UPPER jika MySQL ragu
        sql_direct = text("""
            UPDATE pengeluaran_bengkel 
            SET metode_bayar = 'TRANSFER' 
            WHERE BINARY metode_bayar = 'transfer'
        """)
        res = db.execute(sql_direct)
        print(f"  -> {res.rowcount} baris dipaksa menjadi 'TRANSFER'.")

        # 2. Cek tabel lain yang mungkin punya nama kolom berbeda (misal: metode_bayar_beli)
        inspector = inspect(db.get_bind())
        tables = inspector.get_table_names()
        
        for table in tables:
            columns = [c['name'] for c in inspector.get_columns(table)]
            for col in columns:
                if col in ['metode_bayar', 'metode_bayar_beli', 'metode']:
                    # Update semua yang mengandung huruf kecil
                    sql_gen = text(f"UPDATE {table} SET {col} = UPPER({col}) WHERE BINARY {col} REGEXP '[a-z]'")
                    res_gen = db.execute(sql_gen)
                    if res_gen.rowcount > 0:
                        print(f"  -> [{table}.{col}] Berhasil update {res_gen.rowcount} baris.")

        db.commit()
        
        print("\n--- Verifikasi Terakhir ---")
        sql_verify = text("SELECT id, metode_bayar FROM pengeluaran_bengkel WHERE BINARY metode_bayar REGEXP '[a-z]'")
        remains = db.execute(sql_verify).fetchall()
        if remains:
            print(f"Gagal! Masih ada data membandel di pengeluaran_bengkel: {remains}")
            print("Mencoba cara terakhir: Update berdasarkan ID...")
            for row in remains:
                db.execute(text(f"UPDATE pengeluaran_bengkel SET metode_bayar = 'TRANSFER' WHERE id = {row[0]}"))
            db.commit()
            print("Selesai (Update by ID).")
        else:
            print("DATABASE SUDAH BERSIH!")

    except Exception as e:
        db.rollback()
        print(f"\nTerjadi kesalahan: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_enums_atomic()
