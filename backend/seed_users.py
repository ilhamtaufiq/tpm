import sys
import os
import pkgutil

# Add the current directory to sys.path to allow importing from 'app'
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database.connection import SessionLocal, engine
from app.database.base import Base
from app.utils.security import hash_password
from app.utils.constants import UserRole

# 1. Force load all models to register with Base
import app.models
def load_all_models():
    """Import all modules in app.models to ensure relationships are registered."""
    for loader, module_name, is_pkg in pkgutil.walk_packages(app.models.__path__, app.models.__name__ + "."):
        __import__(module_name)

print("Initializing database mappers...")
try:
    load_all_models()
    # In SQLAlchemy 2.0, registry.configure() is the way to finalize mappers
    Base.registry.configure()
except Exception as e:
    print(f"Note: Mapper initialization info: {e}")

# 2. Import User after models are loaded
from app.models.user import User

def seed_users():
    print("Starting user seeding process...")
    db = SessionLocal()
    try:
        # Verify db connection first
        db.execute(text("SELECT 1"))
        
        users_to_seed = [
            {
                "username": "admin",
                "email": "admin@tpm.com",
                "password": "password123",
                "full_name": "Administrator TPM",
                "role": UserRole.ADMIN,
            },
            {
                "username": "manager",
                "email": "manager@tpm.com",
                "password": "password123",
                "full_name": "Manager Toko",
                "role": UserRole.MANAGER,
            },
            {
                "username": "staff",
                "email": "staff@tpm.com",
                "password": "password123",
                "full_name": "Staff Operasional",
                "role": UserRole.STAFF,
            },
        ]

        for user_data in users_to_seed:
            # Check if user already exists
            existing_user = db.query(User).filter(User.username == user_data["username"]).first()
            if not existing_user:
                new_user = User(
                    username=user_data["username"],
                    email=user_data["email"],
                    hashed_password=hash_password(user_data["password"]),
                    full_name=user_data["full_name"],
                    role=user_data["role"],
                    is_active=True
                )
                db.add(new_user)
                print(f"  + Created user: {user_data['username']} ({user_data['role']})")
            else:
                print(f"  - User {user_data['username']} already exists.")
        
        db.commit()
        print("\nSUCCESS: Seeding completed successfully!")
    except Exception as e:
        print(f"\nFATAL ERROR during seeding: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    seed_users()
