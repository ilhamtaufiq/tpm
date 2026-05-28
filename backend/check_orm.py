
import sys
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.models.bengkel import PengeluaranBengkel

# Database connection
DATABASE_URL = settings.database_url
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def test_orm_query():
    db = SessionLocal()
    try:
        print("Querying PengeluaranBengkel...")
        # Try to fetch all
        items = db.query(PengeluaranBengkel).all()
        print(f"Fetched {len(items)} items.")
        for item in items:
            print(f"ID: {item.id}, Kategori: {item.kategori} (Type: {type(item.kategori)})")
            
    except Exception as e:
        print(f"ERROR: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    test_orm_query()
