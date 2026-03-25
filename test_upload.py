import requests
import sys

URL = "http://localhost:8000/api/v1/auth/me/avatar"
TOKEN = "your_token_here" # I'll try to find a token or use a script to get one

def test_upload(token):
    with open("assets/icon.png", "rb") as f:
        files = {"file": ("avatar.png", f, "image/png")}
        headers = {"Authorization": f"Bearer {token}"}
        r = requests.post(URL, files=files, headers=headers)
        print(r.status_code)
        print(r.json())

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_upload.py <token>")
        sys.exit(1)
    test_upload(sys.argv[1])
