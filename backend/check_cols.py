from app.database.connection import engine
from sqlalchemy import text

with engine.connect() as conn:
    res = conn.execute(text("SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'mobil' AND TABLE_SCHEMA = 'tpm_db'")).all()
    for row in res:
        print(f"{row[0]:<20} | {row[1]:<10} | {row[2]}")
