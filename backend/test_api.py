import requests
import json

url = "http://127.0.0.1:8000/api/v1/transaksi-bengkel"
payload = {
    "tanggal": "2026-01-31",
    "nomor_plat": "B 1234 ABCDEFGHIJKL", # 18 chars, max is 15
    "jenis_kendaraan": "Honda Vario",
    "nama_customer": "Budi",
    "metode_bayar": "tunai",
    "detail_services": [
        {
            "nama_jasa": "Ganti Oli",
            "harga": 50000,
            "qty": 1
        }
    ],
    "detail_parts": [],
    "jumlah_bayar": 50000
}

try:
    # hit with too long nomor_plat
    response = requests.post(url, json=payload)
    print(f"Test 1 (Long Plat) - Status Code: {response.status_code}")
    print(f"Response Body: {response.text}")

    # hit with correct payload but missing diskon (should be fine as it has default)
    payload["nomor_plat"] = "B 1234 ABC"
    response = requests.post(url, json=payload)
    print(f"Test 2 (Correct) - Status Code: {response.status_code}")
    print(f"Response Body: {response.text}")

except Exception as e:
    print(f"Error: {e}")
