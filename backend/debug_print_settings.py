from app.database.connection import SessionLocal
from app.models.system_setting import SystemSetting
import json

db = SessionLocal()
setting = db.query(SystemSetting).filter(SystemSetting.key == "print_config").first()
if setting:
    print(f"Key: {setting.key}")
    try:
        val = json.loads(setting.value)
        print(f"Has logo: {'logo_uri' in val}")
        if 'logo_uri' in val:
            print(f"Logo prefix: {val['logo_uri'][:50]}")
        print(f"Company: {val.get('company_name')}")
    except Exception as e:
        print(f"JSON Error: {e}")
        print(f"Value sample: {setting.value[:100]}")
else:
    print("print_config not found")
db.close()
