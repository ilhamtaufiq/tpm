import MySQLdb
conn=MySQLdb.connect(host='localhost', user='root', passwd='', db='tpm_db')
cursor=conn.cursor()

print("--- AUDIT: COMPARING KAS_BANK AND OPERATIONAL TABLES ---")

# 1. Get all KELUAR from KasBank today
cursor.execute("SELECT id, nominal, keterangan, tanggal FROM kas_bank WHERE tipe = 'KELUAR' AND tanggal >= '2026-04-21'")
kas_out = cursor.fetchall()

# 2. Get all Expenses from PengeluaranBengkel (Workshop/Unit Wallet)
cursor.execute("SELECT id, jumlah, deskripsi, tanggal FROM pengeluaran_bengkel WHERE tanggal >= '2026-04-21'")
pgl_out = cursor.fetchall()
pgl_dict = {float(r[1]): r[2] for r in pgl_out} # Simple map for quick check

# 3. Get all JA Muatan Ops
cursor.execute("SELECT jumlah, deskripsi FROM jasa_angkut_biaya_lainnya")
ja_ops = cursor.fetchall()
ja_dict = {float(r[0]): r[1] for r in ja_ops}

print(f"\nFOUND {len(kas_out)} KAS OUT ENTRIES:")
for k in kas_out:
    nom = float(k[1])
    ket = k[2]
    
    # Check if this matches anything in PGL or JA
    match_pgl = any(abs(float(p[1]) - nom) < 0.01 for p in pgl_out)
    match_ja = any(abs(float(j[0]) - nom) < 0.01 for j in ja_ops)
    
    status = "OK (MATCHED)" if (match_pgl or match_ja) else "MISSING FROM REPORTS!"
    
    print(f"[{status}] {nom} - {ket}")

conn.close()
