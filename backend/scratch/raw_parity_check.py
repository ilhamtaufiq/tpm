import MySQLdb
from decimal import Decimal

# Database connection
db_config = {
    'host': 'localhost',
    'user': 'root',
    'passwd': '',
    'db': 'tpm_db'
}

try:
    conn = MySQLdb.connect(**db_config)
    cursor = conn.cursor()

    # 1. Total Kas
    cursor.execute("SELECT SUM(CASE WHEN tipe='MASUK' THEN nominal ELSE -nominal END) FROM kas_bank")
    total_cash = cursor.fetchone()[0] or 0

    # 2. Total Piutang
    cursor.execute("SELECT SUM(sisa_piutang) FROM piutang_usaha")
    total_piutang = cursor.fetchone()[0] or 0

    # 3. Total Hutang
    cursor.execute("SELECT SUM(sisa_hutang) FROM hutang_usaha")
    total_hutang = cursor.fetchone()[0] or 0

    # 4. Total Stock Mobil (HPP price only)
    cursor.execute("SELECT SUM(harga_beli) FROM mobil WHERE status='TERSEDIA'")
    total_stock_mobil = cursor.fetchone()[0] or 0

    # 5. Total Stock Sparepart
    cursor.execute("SELECT SUM(stok * harga_beli) FROM spare_parts")
    total_stock_part = cursor.fetchone()[0] or 0

    # 6. Total Laba TPM from Sales
    cursor.execute("SELECT SUM(laba_tpm) FROM transaksi_penjualan_mobil WHERE status_bayar != 'BATAL'")
    laba_tpm_sales = cursor.fetchone()[0] or 0

    # 7. Total Expenses (Operational)
    cursor.execute("SELECT SUM(jumlah) FROM pengeluaran_bengkel WHERE kategori != 'PRIVE'")
    total_expenses = cursor.fetchone()[0] or 0

    # 8. Total Prive
    cursor.execute("SELECT SUM(jumlah) FROM pengeluaran_bengkel WHERE kategori = 'PRIVE'")
    total_prive = cursor.fetchone()[0] or 0

    # 9. Total Laba JA (Simplified)
    # Using muatans table for Jasa Angkut
    cursor.execute("SELECT SUM(laba_tpm) FROM muatan_jasa_angkut")
    laba_ja = cursor.fetchone()[0] or 0

    print(f"Total Cash: {float(total_cash):,.2f}")
    print(f"Total Piutang: {float(total_piutang):,.2f}")
    print(f"Total Stock Mobil: {float(total_stock_mobil):,.2f}")
    print(f"Total Stock Part: {float(total_stock_part):,.2f}")
    assets = float(total_cash + total_piutang + total_stock_mobil + total_stock_part)
    print(f"Total Assets (A): {assets:,.2f}")

    print(f"\nTotal Hutang (L): {float(total_hutang):,.2f}")

    print(f"\nLaba TPM Sales: {float(laba_tpm_sales):,.2f}")
    print(f"Laba JA: {float(laba_ja):,.2f}")
    print(f"Total Expenses: {float(total_expenses):,.2f}")
    net_profit = float(laba_tpm_sales + laba_ja - total_expenses)
    print(f"Net Profit (Simplified): {net_profit:,.2f}")

    # Reconciliation check
    liabilities = float(total_hutang)
    equity = float(laba_tpm_sales + laba_ja - total_expenses - total_prive) # Simplified retained earnings

    print(f"\n--- PARITY CHECK ---")
    print(f"Assets: {assets:,.2f}")
    print(f"L + E: {(liabilities + equity):,.2f}")
    print(f"DIFF: {(assets - (liabilities + equity)):,.2f}")

    conn.close()

except Exception as e:
    print(f"Error: {e}")
