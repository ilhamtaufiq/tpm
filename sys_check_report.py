import json
from urllib.request import Request, urlopen

req = Request('http://127.0.0.1:8000/api/v1/dashboard/capital-report?tanggal_dari=2026-04-01&tanggal_sampai=2026-04-30')
req.add_header('Accept', 'application/json')
with urlopen(req) as res:
    data = json.loads(res.read())
    print(f"A: {data['section_a']['total_a']}")
    print(f"B: {data['section_b']['total_b']}")
    print(f"C: {data['section_c']['total_c']}")
    print(f"E: {data['section_e']['total_e']}")
    print(f"Theo: {data['section_d']['theoretical_modal']}")
    print(f"Cash: {data['section_d']['cash']}")
    print(f"Selisih: {data['section_d']['penyesuaian']}")
