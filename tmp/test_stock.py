import sys
import os

# Add the backend directory to sys.path
sys.path.append(r'c:\laragon\www\tpm\backend')

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.services.spare_part_service import SparePartService

# Database setup
engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    service = SparePartService(db)
    print("Testing get_stock_value...")
    result = service.get_stock_value()
    print("Result:", result)
except Exception as e:
    import traceback
    with open(r'c:\laragon\www\tpm\tmp\error_stock.txt', 'w') as f:
        traceback.print_exc(file=f)
    print("Error written to tmp/error_stock.txt")
finally:
    db.close()
