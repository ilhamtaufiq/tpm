import re

def normalize(text):
    text = text.lower().strip()
    text = re.sub(r'int\(\d+\)', 'int', text)
    text = re.sub(r'character set \w+', '', text)
    text = re.sub(r'collate \w+', '', text)
    text = re.sub(r'\s+', ' ', text)
    return text

def parse_full_schema(filename):
    with open(filename, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    # Improved regex for optional backticks
    pattern = r'create\s+table\s+`?(\w+)`?\s*\((.*?)\)\s*engine=.*?;'
    tables = re.findall(pattern, content, re.DOTALL | re.IGNORECASE)
    schema_dict = {}
    for name, body in tables:
        schema_dict[name.lower()] = normalize(body)
    return schema_dict

local_data = parse_full_schema(r'c:\laragon\www\tpm\schema_local.sql')
vps_data = parse_full_schema(r'c:\laragon\www\tpm\Untitled-1.txt')

all_tables = sorted(set(local_data.keys()) | set(vps_data.keys()))

print(f"[*] Comparison Summary:")
print(f"    - Local Tables: {len(local_data)}")
print(f"    - VPS Tables:   {len(vps_data)}\n")

for t in all_tables:
    if t not in local_data:
        print(f"[!] MISSING LOCALLY: {t}")
    elif t not in vps_data:
        print(f"[!] MISSING ON VPS:  {t}")
    elif local_data[t] != vps_data[t]:
        print(f"[-] MISMATCH: {t}")
        # Detect exact column difference if possible (simple split by comma)
        local_cols = set(local_data[t].split(','))
        vps_cols = set(vps_data[t].split(','))
        
        diff_local = local_cols - vps_cols
        diff_vps = vps_cols - local_cols
        
        if diff_local:
            print(f"    - Present Local only: {list(diff_local)[:2]}...")
        if diff_vps:
            print(f"    - Present VPS only:   {list(diff_vps)[:2]}...")
    else:
        # print(f"[OK] {t}")
        pass
