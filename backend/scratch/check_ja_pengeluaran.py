import MySQLdb
conn=MySQLdb.connect(host='localhost', user='root', passwd='', db='tpm_db')
cursor=conn.cursor()
cursor.execute("SELECT bisnis_kategori, kategori, deskripsi, jumlah FROM pengeluaran_bengkel WHERE bisnis_kategori = 'jasa_angkut'")
for r in cursor.fetchall():
    print(r)
conn.close()
