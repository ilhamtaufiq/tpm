import MySQLdb
from decimal import Decimal

db_config = {'host': 'localhost', 'user': 'root', 'passwd': '', 'db': 'tpm_db'}
conn = MySQLdb.connect(**db_config)
cursor = conn.cursor()

# 1. Total Assets Calculation
cursor.execute("SELECT SUM(CASE WHEN tipe='MASUK' THEN nominal ELSE -nominal END) FROM kas_bank")
total_cash = cursor.fetchone()[0] or 0

cursor.execute("SELECT SUM(sisa_piutang) FROM piutang_usaha")
total_piutang = cursor.fetchone()[0] or 0

# 4. Total Stock Mobil (Purchase Price + Capitalized Prep/Repairs)
cursor.execute("SELECT id, harga_beli FROM mobil WHERE status='TERSEDIA'")
unsold_cars = cursor.fetchall()
total_stock_mobil = 0
for cid, hbeli in unsold_cars:
    total_stock_mobil += float(hbeli)
    # Add Prep costs
    cursor.execute("SELECT SUM(jumlah) FROM mobil_biaya_lainnya WHERE mobil_id=%s", (cid,))
    total_stock_mobil += float(cursor.fetchone()[0] or 0)
    # Add Internal Repair costs
    cursor.execute("SELECT SUM(grand_total) FROM transaksi_penjualan_bengkel WHERE mobil_id=%s AND status_bayar != 'BATAL'", (cid,))
    total_stock_mobil += float(cursor.fetchone()[0] or 0)

cursor.execute("SELECT SUM(stok * harga_beli) FROM spare_parts")
total_stock_part = cursor.fetchone()[0] or 0

assets = float(total_cash + total_piutang + total_stock_mobil + total_stock_part)

# 2. Liabilities
cursor.execute("SELECT SUM(sisa_hutang) FROM hutang_usaha")
total_hutang = cursor.fetchone()[0] or 0
liabilities = float(total_hutang)

# 3. Equity (Capital + Net Profit - Prive)
cursor.execute("SELECT SUM(nominal) FROM kas_bank WHERE sumber='MODAL'")
capital_base = cursor.fetchone()[0] or 0
# Include the manual 200k transfer as injection
cursor.execute("SELECT SUM(nominal) FROM kas_bank WHERE tipe='MASUK' AND keterangan LIKE '%Terima Dana dari Akun Utama%'")
capital_injection = cursor.fetchone()[0] or 0
capital = capital_base + capital_injection

cursor.execute("SELECT SUM(laba_tpm) FROM transaksi_penjualan_mobil WHERE status_bayar != 'BATAL'")
laba_mobil = cursor.fetchone()[0] or 0

cursor.execute("SELECT SUM(laba_tpm) FROM muatan_jasa_angkut")
laba_ja = cursor.fetchone()[0] or 0

cursor.execute("SELECT SUM(grand_total - hpp_parts) FROM transaksi_penjualan_bengkel WHERE kategori='umum' AND status_bayar != 'BATAL'") # Workshop external profit
laba_bengkel_ext = cursor.fetchone()[0] or 0

cursor.execute("SELECT SUM(jumlah) FROM pengeluaran_bengkel WHERE kategori != 'PRIVE'")
expenses = cursor.fetchone()[0] or 0

cursor.execute("SELECT SUM(jumlah) FROM pengeluaran_bengkel WHERE kategori = 'PRIVE'")
prive = cursor.fetchone()[0] or 0

# POST-SALE EXPENSE CHECK (The one we just fixed in base.py)
cursor.execute("""
    SELECT SUM(p.jumlah) 
    FROM pengeluaran_bengkel p 
    JOIN mobil m ON p.mobil_id = m.id 
    WHERE p.bisnis_kategori IN ('mobil', 'jual_beli_mobil', 'penjualan_mobil') 
    AND p.tanggal > m.tanggal_terjual
""")
post_sale_exp = cursor.fetchone()[0] or 0

# 4. JA Double Count Adjustment
# When JA income is recorded as 'Net' in kas_bank, but expenses are also recorded as 'Keluar'
cursor.execute("""
    SELECT SUM(nominal) 
    FROM kas_bank 
    WHERE tipe='KELUAR' 
    AND sumber='JASA_ANGKUT' 
    AND keterangan LIKE 'Biaya Operational Muatan%'
""")
ja_double_exp = cursor.fetchone()[0] or 0

equity = float(capital + laba_mobil + laba_ja + laba_bengkel_ext - expenses - prive - ja_double_exp)

print(f"ASSETS (Cash {float(total_cash):,.0f} + Inv {float(total_stock_mobil+total_stock_part):,.0f} + Piutang {float(total_piutang):,.0f}): {assets:,.2f}")
print(f"LIABILITIES: {liabilities:,.2f}")
print(f"CAPITAL: {float(capital):,.2f}")
print(f"PROFIT (Sale {float(laba_mobil):,.0f} + JA {float(laba_ja):,.0f} + Bgl {float(laba_bengkel_ext):,.0f}): {float(laba_mobil+laba_ja+laba_bengkel_ext):,.02f}")
print(f"EXPENSES (Incl Prive): {float(expenses+prive):,.2f}")
print(f"EQUITY: {equity:,.2f}")

print(f"\n--- PARITY ---")
print(f"A = L + E  =>  {assets:,.2f} = {(liabilities + equity):,.2f}")
print(f"DIFF: {(assets - (liabilities + equity)):,.2f}")

if abs(assets - (liabilities + equity)) < 1:
    print("\n[RESULT] NERACA BALANCED! PERFECT PARITY ACHIEVED.")
else:
    print("\n[RESULT] STILL UNBALANCED. ANALYZING REMAINING DIFF...")
    
    # Check if there is some 'MASUK' entry with no category that acts like capital
    cursor.execute("SELECT nominal, sumber, keterangan FROM kas_bank WHERE tipe='MASUK' AND sumber NOT IN ('JUAL_BELI_MOBIL', 'JASA_ANGKUT', 'BENGKEL', 'MODAL')")
    others = cursor.fetchall()
    if others:
        print("\nFound other income entries that might be capital:")
        for o in others:
            print(f"- {float(o[0]):,.0f} ({o[1]}): {o[2]}")

conn.close()
