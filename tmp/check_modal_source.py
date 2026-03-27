
import sqlalchemy
from sqlalchemy import text
engine=sqlalchemy.create_engine('mysql+mysqldb://root:@localhost:3306/tpm_db')
with engine.connect() as conn:
    print("--- KASBANK SOURCE MODAL ---")
    res=conn.execute(text("SELECT id, tipe, nominal, keterangan FROM kas_bank WHERE sumber = 'MODAL'"))
    for r in res:
        print(f"{r[0]} | {r[1]} | {r[2]} | {r[3]}")
