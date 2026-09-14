import sys
import os

# Add backend directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.connection import SessionLocal
from app.models.user import User
from app.utils.security import hash_password
from app.utils.constants import UserRole


def create_god_user():
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == "god").first()
        if existing:
            print("User 'god' sudah ada di database.")
            return

        user = User(
            full_name="God Mode Admin",
            username="god",
            email="god@tpm.com",
            hashed_password=hash_password("password123"),
            role=UserRole.ADMIN,
            is_active=True,
        )
        db.add(user)
        db.commit()
        print("User 'god' (password: password123) berhasil dibuat!")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    create_god_user()
