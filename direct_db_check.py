
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
        result = conn.execute(text("SELECT id, nama, gaji_pokok FROM karyawan WHERE kode = 'KRY26020004'"))
        row = result.fetchone()
        if row:
            print(f"ID: {row[0]}, Nama: {row[1]}, Gaji Pokok: {row[2]}")
        else:
            print("Not found")

if __name__ == "__main__":
    check()
