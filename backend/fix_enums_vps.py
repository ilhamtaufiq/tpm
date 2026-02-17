from sqlalchemy import text
from app.database import SessionLocal

def fix_enums():
    db = SessionLocal()
    # Daftar tabel dan kolom yang kemungkinan menggunakan PaymentMethod
    targets = [
        ("kas_bank", "metode_bayar"),
        ("pembayaran_piutang", "metode_bayar"),
        ("pembayaran_hutang", "metode_bayar"),
        ("transaksi_bengkel", "metode_bayar"),
        ("pengeluaran", "metode_bayar")
    ]
    
    print("Mulai perbaikan enum di database...")
    
    try:
        for table, column in targets:
            # Cek apakah tabel ada
            check_table = db.execute(text(f"SHOW TABLES LIKE '{table}'")).fetchone()
            if not check_table:
                continue
                
            # Update semua nilai menjadi UPPERCASE
            print(f"Mengupdate {table}.{column} menjadi UPPERCASE...")
            sql = text(f"UPDATE {table} SET {column} = UPPER({column}) WHERE {column} IS NOT NULL")
            result = db.execute(sql)
            print(f"Berhasil mengupdate {result.rowcount} baris di {table}")
            
        db.commit()
        print("\nSemua data berhasil diperbaiki menjadi HURUF BESAR.")
    except Exception as e:
        db.rollback()
        print(f"\nTerjadi kesalahan: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_enums()
