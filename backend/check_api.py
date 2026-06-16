
import requests
import json

# Try to call local API on port 8000 (default in settings)
# We need an auth token though. We'll skip and try to find a simpler way.
# Or just use the test client if we have the app instance.

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))

from app.main import app
from fastapi.testclient import TestClient

def check_neraca_api():
    client = TestClient(app)
    # This might fail due to auth dependencies (CurrentUser/ManagerUser)
    # but we'll try to bypass or see if it works without mocks
    try:
        response = client.get("/api/v1/dashboard/neraca")
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            stok = data.get("aktiva_lancar", {}).get("stok_mobil")
            print(f"Stok Mobil from API: {stok}")
        else:
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error calling API: {e}")

if __name__ == "__main__":
    check_neraca_api()
