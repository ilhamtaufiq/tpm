from app.database.connection import engine
from sqlalchemy import text

tables_to_fix = {
    "muatan_jasa_angkut": ["status_bayar", "metode_bayar"],
    "transaksi_penjualan_bengkel": ["status_bayar", "metode_bayar"],
    "piutang_usaha": ["status"],
    "kas_bank": ["metode_bayar"],
    "pembelian_spare_parts": ["status_bayar", "metode_bayar"],
    "slip_gaji": ["status_bayar"]
}

with engine.connect() as conn:
    for table, columns in tables_to_fix.items():
        print(f"\nChecking table {table}...")
        for col in columns:
            try:
                res = conn.execute(text(f"SHOW COLUMNS FROM {table} LIKE '{col}'")).fetchone()
                if res:
                    print(f"  Column {col}: {res[1]}")
                else:
                    print(f"  Column {col} NOT FOUND")
            except Exception as e:
                print(f"  Error checking {table}.{col}: {e}")

print("\n--- End of report ---")
