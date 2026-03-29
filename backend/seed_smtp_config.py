import json
import os
import sys

# Add the current directory to sys.path to allow importing from 'app'
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.connection import SessionLocal
from app.models.system_setting import SystemSetting

def seed_smtp():
    db = SessionLocal()
    try:
        # Default SMTP Config (can be updated later)
        # Using a common setup like Gmail or SendGrid as a template
        config = {
            "server": "smtp.gmail.com",
            "port": 587,
            "username": "your-email@gmail.com",
            "password": "your-app-password",
            "use_tls": True,
            "sender_name": "TPM Security"
        }
        
        # Check if already exists
        setting = db.query(SystemSetting).filter(SystemSetting.key == "smtp_config").first()
        if not setting:
            new_setting = SystemSetting(
                key="smtp_config",
                value=json.dumps(config),
                description="SMTP configuration for sending OTP and password reset emails"
            )
            db.add(new_setting)
            print("Created default SMTP config in system_settings table.")
        else:
            print("SMTP config already exists in database.")
            
        db.commit()
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_smtp()
