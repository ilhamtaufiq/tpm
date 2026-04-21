import MySQLdb
conn=MySQLdb.connect(host='localhost', user='root', passwd='', db='tpm_db')
cursor=conn.cursor()
print("--- Checking PengeluaranBengkel for aqua ---")
cursor.execute("SELECT id, kategori, deskripsi, jumlah, bisnis_kategori FROM pengeluaran_bengkel WHERE deskripsi LIKE '%aqua%' OR catatan LIKE '%aqua%'")
for r in cursor.fetchall():
    print(r)

print("\n--- Checking JasaAngkutBiayaLainnya ---")
cursor.execute("SELECT id, kategori, jumlah, deskripsi FROM jasa_angkut_biaya_lainnya")
for r in cursor.fetchall():
    print(r)

print("\n--- Checking Recent KasBank ---")
cursor.execute("SELECT nominal, tipe, keterangan, tanggal FROM kas_bank ORDER BY id DESC LIMIT 20")
for r in cursor.fetchall():
    print(r)

conn.close()
