from sqlalchemy import text, inspect
from app.database import SessionLocal

def super_fix():
    db = SessionLocal()
    print("Mulai JURUS PAMUNGKAS (Alter Column Type)...")
    
    # Mapping kolom dan pilihan ENUM barunya (HURUF BESAR)
    targets = {
        "kas_bank": ["metode_bayar"],
        "pembayaran_piutang": ["metode_bayar"],
        "pembayaran_hutang": ["metode_bayar"],
        "transaksi_penjualan_bengkel": ["metode_bayar"],
        "pembelian_spare_parts": ["metode_bayar"],
        "pengeluaran_bengkel": ["metode_bayar"],
        "mobil": ["metode_bayar_beli"],
        "transaksi_penjualan_mobil": ["metode_bayar"],
        "slip_gaji": ["metode_bayar"]
    }
    
    new_enum_values = "'TUNAI','TRANSFER','KREDIT','DEBIT','SPLIT','INTERNAL','OTHER'"

    try:
        for table, cols in targets:
            # Cek apakah tabel ada
            check = db.execute(text(f"SHOW TABLES LIKE '{table}'")).fetchone()
            if not check: continue

            for col in cols:
                print(f"Memproses {table}.{col}...")
                
                # 1. Ubah ke VARCHAR supaya bisa menampung apapun
                db.execute(text(f"ALTER TABLE {table} MODIFY COLUMN {col} VARCHAR(255)"))
                
                # 2. Paksa jadi UPPERCASE dan hapus spasi
                db.execute(text(f"UPDATE {table} SET {col} = UPPER(TRIM({col})) WHERE {col} IS NOT NULL"))
                
                # 3. Kembalikan ke ENUM dengan pilihan huruf BESAR
                try:
                    db.execute(text(f"ALTER TABLE {table} MODIFY COLUMN {col} ENUM({new_enum_values})"))
                except Exception as e:
                    print(f"  Peringatan saat mengembalikan ke ENUM di {table}.{col}: {e}")
                    print("  Dibiarkan tetap VARCHAR agar aplikasi tidak crash.")
            
        db.commit()
        print("\n--- SELESAI ---")
        print("Data sudah dikonversi secara paksa di level database.")
        print("Mohon jalankan: sudo systemctl restart tpm-app-backend")

    except Exception as e:
        db.rollback()
        print(f"Gagal Total: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    super_fix()
