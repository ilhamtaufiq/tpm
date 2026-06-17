from app.database.connection import engine
from sqlalchemy import text

with engine.connect() as conn:
    res = conn.execute(text("SELECT CONSTRAINT_SCHEMA, TABLE_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_SCHEMA, REFERENCED_TABLE_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME = 'mobil' AND REFERENCED_TABLE_NAME IS NOT NULL")).all()
    for row in res:
        print(row)
