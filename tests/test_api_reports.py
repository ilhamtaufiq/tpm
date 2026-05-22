import requests
import datetime
import sys

# URL Backend API
BASE_URL = "http://localhost:8000"

def get_auth_token():
    """Login to backend API and get JWT token"""
    login_url = f"{BASE_URL}/api/v1/auth/login"
    payload = {
        "username": "admin",
        "password": "password123"
    }
    print(f"🔑 Logging in to {login_url}...")
    # OAuth2PasswordRequestForm expects form data, not JSON
    res = requests.post(login_url, data=payload)
    if res.status_code != 200:
        raise ValueError(f"Failed to log in: {res.text}")
    
    token_data = res.json()
    return token_data.get("access_token")

def test_reports_sync():
    print("="*60)
    print("🔍 MENGUJI SINKRONISASI LAPORAN KEUANGAN TPM")
    print("="*60)

    try:
        # Get Auth Token
        token = get_auth_token()
        headers = {"Authorization": f"Bearer {token}"}
        print("✅ Berhasil mendapatkan JWT token")

        # 1. Parameter Waktu (Bulan Ini)
        today = datetime.date.today()
        first_day = today.replace(day=1).strftime("%Y-%m-%d")
        last_day = today.strftime("%Y-%m-%d")

        # A. Laba Rugi
        print(f"\n1. Meminta Laba Rugi ({first_day} - {last_day})...")
        res_lr = requests.get(f"{BASE_URL}/api/v1/laporan/laba-rugi", params={"tanggal_dari": first_day, "tanggal_sampai": last_day}, headers=headers)
        if res_lr.status_code != 200:
            print(f"❌ Gagal mengambil Laba Rugi: {res_lr.text}")
            return
        data_lr = res_lr.json()
        laba_bersih_lr = data_lr.get("laba_bersih", 0)

        # B. Perubahan Modal
        print(f"2. Meminta Perubahan Modal ({first_day} - {last_day})...")
        res_pm = requests.get(f"{BASE_URL}/api/v1/laporan/perubahan-modal", params={"tanggal_dari": first_day, "tanggal_sampai": last_day}, headers=headers)
        if res_pm.status_code != 200:
            print(f"❌ Gagal mengambil Perubahan Modal: {res_pm.text}")
            return
        data_pm = res_pm.json()
        laba_bersih_pm = data_pm.get("laba_ditahan_periode", 0)
        is_balanced_pm = data_pm.get("is_balanced", False)
        selisih_pm = data_pm.get("selisih", 0)

        # C. Neraca
        print(f"3. Meminta Neraca (As of {last_day})...")
        res_n = requests.get(f"{BASE_URL}/api/v1/laporan/neraca", params={"as_of_date": last_day}, headers=headers)
        if res_n.status_code != 200:
            print(f"❌ Gagal mengambil Neraca: {res_n.text}")
            return
        data_n = res_n.json()
        is_balanced_n = data_n.get("is_balanced", False)
        selisih_n = data_n.get("selisih", 0)
        laba_bersih_n = data_n.get("cross_validation", {}).get("laba_bersih_from_base", 0)

        print("\n" + "="*60)
        print("📊 HASIL VALIDASI LAPORAN")
        print("="*60)

        # Cek Perubahan Modal
        if is_balanced_pm and abs(selisih_pm) < 100:
            print(f"✅ Laporan Perubahan Modal: BALANCED (Selisih: Rp {selisih_pm:,.2f})")
        else:
            print(f"❌ Laporan Perubahan Modal: SELISIH Rp {selisih_pm:,.2f}")

        # Cek Neraca
        if is_balanced_n and abs(selisih_n) < 100:
            print(f"✅ Laporan Neraca: BALANCED (Selisih: Rp {selisih_n:,.2f})")
        else:
            print(f"❌ Laporan Neraca: SELISIH Rp {selisih_n:,.2f}")

        # Cek Sinkronisasi Laba Bersih
        print("\n🔄 Cek Sinkronisasi Laba Bersih:")
        print(f"   - Laba Rugi       : Rp {laba_bersih_lr:,.2f}")
        print(f"   - Perubahan Modal : Rp {laba_bersih_pm:,.2f}")
        print(f"   - Neraca          : Rp {laba_bersih_n:,.2f}")

        if abs(laba_bersih_lr - laba_bersih_pm) < 1 and abs(laba_bersih_lr - laba_bersih_n) < 1:
            print("✅ SINKRON (Semua modul melaporkan Laba Bersih yang persis sama)")
        else:
            print("❌ TIDAK SINKRON (Ada perbedaan Laba Bersih antar modul)")

    except Exception as e:
        print(f"❌ Error: {e}")
        print("Pastikan server FastAPI sedang berjalan di http://localhost:8000")

if __name__ == "__main__":
    test_reports_sync()

if __name__ == "__main__":
    test_reports_sync()
