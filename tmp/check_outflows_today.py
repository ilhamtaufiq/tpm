
import sqlalchemy
from sqlalchemy import text
engine=sqlalchemy.create_engine('mysql+mysqldb://root:@localhost:3306/tpm_db')
with engine.connect() as conn:
    res=conn.execute(text("SELECT id, nominal, keterangan, sumber FROM kas_bank WHERE tanggal = '2026-03-27' AND tipe = 'KELUAR'"))
    for r in res:
        print(f"{r[0]}; {r[1]}; {r[2]}; {r[3]}")
