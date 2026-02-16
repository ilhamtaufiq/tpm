from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    result = db.execute(text("SHOW COLUMNS FROM kas_bank LIKE 'sumber'")).fetchone()
    print(f"Column Type: {result[1]}")
finally:
    db.close()
