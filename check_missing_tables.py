import re

def get_tables(f):
    content = open(f, 'r', encoding='utf-8', errors='ignore').read()
    # Normalize: match both CREATE TABLE `name` and CREATE TABLE name
    return set(re.findall(r'CREATE TABLE\s+`?(\w+)', content, re.IGNORECASE))

local_ts = get_tables('schema_local.sql')
vps_ts = get_tables('Untitled-1.txt')

local_lower = {t.lower() for t in local_ts}
vps_lower = {t.lower() for t in vps_ts}

print(f"Total Local: {len(local_lower)}")
print(f"Total VPS: {len(vps_lower)}")
print(f"Extra on VPS (Missing Locally): {vps_lower - local_lower}")
print(f"Extra Locally (Missing on VPS): {local_lower - vps_lower}")
