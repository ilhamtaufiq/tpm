import MySQLdb

db_config = {'host': 'localhost', 'user': 'root', 'passwd': '', 'db': 'tpm_db'}
conn = MySQLdb.connect(**db_config)
cursor = conn.cursor()

cursor.execute("SELECT nominal, keterangan FROM kas_bank WHERE sumber='MODAL' OR keterangan LIKE '%modal%'")
for row in cursor.fetchall():
    print(f"Modal Found: {row[0]:,.2f} - {row[1]}")

conn.close()
