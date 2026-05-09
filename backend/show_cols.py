from app.database.connection import engine
from sqlalchemy import text

with engine.connect() as conn:
    res = conn.execute(text("SHOW COLUMNS FROM mobil")).all()
    for row in res:
        print(row)
