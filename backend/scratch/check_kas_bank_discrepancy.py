import MySQLdb
conn=MySQLdb.connect(host='localhost', user='root', passwd='', db='tpm_db')
cursor=conn.cursor()
print("--- Searching for 50k, 100k, 20k in KasBank ---")
cursor.execute("SELECT nominal, tipe, keterangan, tanggal FROM kas_bank WHERE nominal IN (20000, 50000, 100000) ORDER BY tanggal DESC")
for r in cursor.fetchall():
    print(r)
conn.close()
