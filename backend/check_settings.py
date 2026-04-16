from app.database.connection import SessionLocal
from app.models.system_setting import SystemSetting
import json

db = SessionLocal()
setting = db.query(SystemSetting).filter(SystemSetting.key == "print_config").first()
if setting:
    print(f"Key: {setting.key}")
    print(f"Value: {setting.value}")
else:
    print("print_config not found in database")
db.close()
