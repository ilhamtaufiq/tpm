
import sqlalchemy
from sqlalchemy import text
import os

db_user = "root"
db_password = ""
db_host = "localhost"
db_port = 3306
db_name = "tpm_db"

database_url = f"mysql+mysqldb://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

engine = sqlalchemy.create_engine(database_url)

def check():
    with engine.connect() as conn:
        print("--- KASBANK INVESTOR (500,000 OR %investor%) ---")
        query = text("SELECT id, nomor_transaksi, tanggal, tipe, nominal, sumber, keterangan FROM kas_bank WHERE nominal = 500000 OR keterangan LIKE '%investor%' ORDER BY tanggal DESC LIMIT 20")
        results = conn.execute(query)
        for row in results:
            print(f"{row[0]} | {row[1]} | {row[2]} | {row[3]} | {row[4]:,.0f} | {row[5]} | {row[6]}")

if __name__ == "__main__":
    check()
