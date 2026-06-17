
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
        print("--- KASBANK FULL DETAILS ---")
        query = text("SELECT id, nomor_transaksi, tanggal, tipe, nominal, sumber, keterangan, metode_bayar FROM kas_bank WHERE id = 400")
        results = conn.execute(query)
        for row in results:
            print(f"ID: {row[0]}")
            print(f"Num: {row[1]}")
            print(f"Date: {row[2]}")
            print(f"Type: {row[3]}")
            print(f"Nom: {row[4]}")
            print(f"Source: {row[5]}")
            print(f"Desc: {row[6]}")
            print(f"Method: {row[7]}")

if __name__ == "__main__":
    check()
