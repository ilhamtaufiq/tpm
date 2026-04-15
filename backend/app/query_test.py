import requests
import json
import time

def check_dashboard():
    # Attempt to query local API directly if it's running
    try:
        response = requests.get("http://127.0.0.1:8000/api/v1/dashboard/profit-summary", headers={"Authorization": "Bearer TEST"})
        print("Status", response.status_code)
    except Exception as e:
        print("Could not query, api might not be up locally without auth hook")

check_dashboard()
