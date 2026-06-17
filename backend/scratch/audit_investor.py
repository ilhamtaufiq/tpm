import MySQLdb

db_config = {'host': 'localhost', 'user': 'root', 'passwd': '', 'db': 'tpm_db'}
conn = MySQLdb.connect(**db_config)
cursor = conn.cursor()

print("--- INVESTOR DISBURSEMENTS (KAS BANK) ---")
cursor.execute("SELECT nominal, tipe, keterangan FROM kas_bank WHERE keterangan LIKE '%Pencairan%'")
for r in cursor.fetchall():
    print(f"{r[1]}: {float(r[0]):,.0f} - {r[2]}")

print("\n--- INVESTOR PROFITS (TRANSAKSI TABEL) ---")
cursor.execute("SELECT laba_investor, nominal_pencairan, status_pencairan FROM transaksi_penjualan_mobil")
for r in cursor.fetchall():
    print(f"Laba: {float(r[0]):,.0f}, Pencairan: {float(r[1]):,.0f}, Status: {r[2]}")

conn.close()
