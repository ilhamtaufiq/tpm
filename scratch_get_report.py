import requests

BASE_URL = "http://localhost:8000"

def get_auth_token():
    login_url = f"{BASE_URL}/api/v1/auth/login"
    payload = {
        "username": "admin",
        "password": "password123"
    }
    res = requests.post(login_url, data=payload)
    if res.status_code != 200:
        raise ValueError(f"Failed to log in: {res.text}")
    return res.json().get("access_token")

def fetch_data():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    url = f"{BASE_URL}/api/v1/laporan/perubahan-modal"
    res = requests.get(url, params={"tanggal_dari": "2026-04-01", "tanggal_sampai": "2026-04-30"}, headers=headers)
    if res.status_code != 200:
        print(f"Error: {res.text}")
        return
        
    data = res.json()
    import json
    print(json.dumps(data, indent=2))

if __name__ == "__main__":
    fetch_data()
