from app.database.connection import engine
from sqlalchemy import text

def fix_enum_schema():
    with engine.begin() as conn:
        print("Repairing MySQL Enum Schemas...")
        
        # 1. muatan_jasa_angkut (ONLY status_bayar)
        try:
            print("Fixing muatan_jasa_angkut...")
            conn.execute(text("ALTER TABLE muatan_jasa_angkut MODIFY COLUMN status_bayar VARCHAR(50)"))
            conn.execute(text("UPDATE muatan_jasa_angkut SET status_bayar = UPPER(status_bayar) WHERE status_bayar IS NOT NULL"))
            conn.execute(text("ALTER TABLE muatan_jasa_angkut MODIFY COLUMN status_bayar ENUM('LUNAS', 'BELUM_LUNAS', 'CICILAN')"))
        except Exception as e:
            print(f"  Error fixing muatan_jasa_angkut: {e}")

        # 2. transaksi_penjualan_bengkel
        try:
            print("Fixing transaksi_penjualan_bengkel...")
            conn.execute(text("ALTER TABLE transaksi_penjualan_bengkel MODIFY COLUMN status_bayar VARCHAR(50)"))
            conn.execute(text("UPDATE transaksi_penjualan_bengkel SET status_bayar = UPPER(status_bayar) WHERE status_bayar IS NOT NULL"))
            conn.execute(text("ALTER TABLE transaksi_penjualan_bengkel MODIFY COLUMN status_bayar ENUM('LUNAS', 'BELUM_LUNAS', 'CICILAN')"))
            
            conn.execute(text("ALTER TABLE transaksi_penjualan_bengkel MODIFY COLUMN metode_bayar VARCHAR(50)"))
            conn.execute(text("UPDATE transaksi_penjualan_bengkel SET metode_bayar = UPPER(metode_bayar) WHERE metode_bayar IS NOT NULL"))
            conn.execute(text("ALTER TABLE transaksi_penjualan_bengkel MODIFY COLUMN metode_bayar ENUM('TUNAI', 'TRANSFER', 'KREDIT', 'DEBIT', 'SPLIT')"))
        except Exception as e:
            print(f"  Error fixing transaksi_penjualan_bengkel: {e}")

        # 3. pembelian_spare_parts
        try:
            print("Fixing pembelian_spare_parts...")
            conn.execute(text("ALTER TABLE pembelian_spare_parts MODIFY COLUMN status_bayar VARCHAR(50)"))
            conn.execute(text("UPDATE pembelian_spare_parts SET status_bayar = UPPER(status_bayar) WHERE status_bayar IS NOT NULL"))
            conn.execute(text("ALTER TABLE pembelian_spare_parts MODIFY COLUMN status_bayar ENUM('LUNAS', 'BELUM_LUNAS', 'CICILAN')"))
            
            conn.execute(text("ALTER TABLE pembelian_spare_parts MODIFY COLUMN metode_bayar VARCHAR(50)"))
            conn.execute(text("UPDATE pembelian_spare_parts SET metode_bayar = UPPER(metode_bayar) WHERE metode_bayar IS NOT NULL"))
            conn.execute(text("ALTER TABLE pembelian_spare_parts MODIFY COLUMN metode_bayar ENUM('TUNAI', 'TRANSFER', 'KREDIT', 'DEBIT', 'SPLIT')"))
        except Exception as e:
            print(f"  Error fixing pembelian_spare_parts: {e}")

        # 4. kas_bank
        try:
            print("Fixing kas_bank...")
            conn.execute(text("ALTER TABLE kas_bank MODIFY COLUMN metode_bayar VARCHAR(50)"))
            conn.execute(text("UPDATE kas_bank SET metode_bayar = UPPER(metode_bayar) WHERE metode_bayar IS NOT NULL"))
            conn.execute(text("ALTER TABLE kas_bank MODIFY COLUMN metode_bayar ENUM('TUNAI', 'TRANSFER', 'KREDIT', 'DEBIT', 'SPLIT')"))
        except Exception as e:
            print(f"  Error fixing kas_bank: {e}")

    print("\nSchema repair complete.")

if __name__ == "__main__":
    fix_enum_schema()
