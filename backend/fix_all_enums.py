from sqlalchemy import text
from app.database.connection import engine

def fix_all_enums():
    with engine.begin() as conn:
        print("Normalizing PaymentStatus and PaymentMethod to UPPERCASE across all tables...")
        
        tables_cols = [
            ("muatan_jasa_angkut", "status_bayar"),
            ("muatan_jasa_angkut", "metode_bayar"),
            ("transaksi_penjualan_bengkel", "status_bayar"),
            ("transaksi_penjualan_bengkel", "metode_bayar"),
            ("kas_bank", "metode_bayar"),
            ("pembayaran_piutang", "metode_bayar"),
            ("piutang_usaha", "status"),
            ("pembelian_spare_parts", "status_bayar"),
            ("pembelian_spare_parts", "metode_bayar"),
            ("slip_gaji", "status_bayar"),
        ]
        
        for table, col in tables_cols:
            try:
                # Check if table exists
                tbl_check = conn.execute(text(f"SHOW TABLES LIKE '{table}'")).fetchone()
                if not tbl_check:
                    continue
                    
                # Check if column exists
                col_check = conn.execute(text(f"SHOW COLUMNS FROM {table} LIKE '{col}'")).fetchone()
                if col_check:
                    print(f"Updating {table}.{col}...")
                    res = conn.execute(text(f"UPDATE {table} SET {col} = UPPER(REPLACE({col}, ' ', '_')) WHERE {col} IS NOT NULL"))
                    print(f"  -> {res.rowcount} rows updated")
            except Exception as e:
                print(f"  -> Error on {table}.{col}: {e}")

    print("\nNormalization complete.")

if __name__ == "__main__":
    fix_all_enums()
