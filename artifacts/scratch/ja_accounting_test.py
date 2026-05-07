
import requests
import json
import time
from datetime import date

API_URL = 'http://localhost:8000'
AUTH_DATA = {
    'username': 'admin',
    'password': 'password123'
}

def run_test():
    print("Starting Jasa Angkut Accounting Test (Python)...")
    
    # 0. Login
    try:
        response = requests.post(f"{API_URL}/api/v1/auth/login", data=AUTH_DATA)
        response.raise_for_status()
        token = response.json()['access_token']
        headers = {'Authorization': f"Bearer {token}"}
        print("Login successful")
    except Exception as e:
        print(f"Login failed: {e}")
        return

    try:
        # 1. Setup Master Data
        print("\n--- 1. Setup Master Data ---")
        timestamp = int(time.time())
        supir_data = {
            'kode': f"SUP-{timestamp}",
            'nama': f"Supir Test JA {timestamp}",
            'tanggal_bergabung': str(date.today()),
            'is_active': True
        }
        supir_res = requests.post(f"{API_URL}/api/v1/supir", json=supir_data, headers=headers)
        if supir_res.status_code != 201:
            print(f"Failed to create supir. Status: {supir_res.status_code}, Body: {supir_res.text}")
            return
        supir_id = supir_res.json()['id']
        print(f"Supir created: ID {supir_id}")

        armada_data = {
            'nama': f"Truk Test JA {timestamp}",
            'nopol': f"B {timestamp % 10000} PY",
            'jenis': 'Colt Diesel',
            'is_active': True
        }
        armada_res = requests.post(f"{API_URL}/api/v1/armada", json=armada_data, headers=headers)
        if armada_res.status_code != 201:
            print(f"Failed to create armada. Status: {armada_res.status_code}, Body: {armada_res.text}")
            return
        armada_id = armada_res.json()['id']
        print(f"Armada created: ID {armada_id}")

        # 2. Create Muatan
        print("\n--- 2. Create Muatan (Trip) ---")
        muatan_data = {
            'tanggal': str(date.today()),
            'supir_id': supir_id,
            'armada_id': armada_id,
            'asal': 'Gudang Python',
            'tujuan': 'Pabrik Python',
            'jenis_muatan': 'Pasir',
            'harga_beli': 500000,
            'harga_jual': 1500000,
            'persentase_tpm': 50,
            'biaya_operasional': [
                {'deskripsi': 'BBM', 'jumlah': 100000},
                {'deskripsi': 'Tol', 'jumlah': 50000}
            ],
            'status_bayar': 'BELUM_LUNAS'
        }
        muatan_res = requests.post(f"{API_URL}/api/v1/muatan", json=muatan_data, headers=headers)
        muatan_res.raise_for_status()
        muatan = muatan_res.json()
        muatan_id = muatan['id']
        nomor_muatan = muatan['nomor_transaksi']
        print(f"Muatan created: {nomor_muatan} (ID: {muatan_id})")
        print(f"   Laba Supir (50%): {muatan['laba_supir']}")
        print(f"   Laba TPM (Gross): {muatan['laba_tpm']}")

        # 3. Create Internal Repair
        print("\n--- 3. Create Internal Repair ---")
        bengkel_data = {
            'tanggal': str(date.today()),
            'nama_customer': 'JASA ANGKUT UNIT',
            'kategori': 'jasa_angkut',
            'muatan_id': muatan_id,
            'armada_id': armada_id,
            'detail_services': [
                {'nama_jasa': 'Ganti Oli Python', 'harga': 100000, 'qty': 1}
            ],
            'metode_bayar': 'INTERNAL',
            'status_bayar': 'BELUM_LUNAS'
        }
        bengkel_res = requests.post(f"{API_URL}/api/v1/transaksi-bengkel", json=bengkel_data, headers=headers)
        bengkel_res.raise_for_status()
        print(f"Workshop Transaction created: {bengkel_res.json()['nomor_transaksi']}")

        # 4. Verification
        print("\n--- 4. Verification ---")
        
        # A. Summary
        summary_res = requests.get(f"{API_URL}/api/v1/muatan/summary", headers=headers)
        summary = summary_res.json()
        print(f"JA Summary:")
        print(f"   Total Pendapatan (TPM Share): {summary['total_pendapatan']}")
        print(f"   Total Biaya Trip (BBM+Tol): {summary['total_biaya_trip']}")
        print(f"   Total Biaya Bengkel: {summary['details']['biaya_bengkel']}")
        # Net TPM = Gross TPM (500k) - Trip (150k) - Bengkel (100k) = 250k
        print(f"   Net Laba TPM (Calculated in Summary): {summary['laba_tpm']}")

        # B. Neraca
        neraca_res = requests.get(f"{API_URL}/api/v1/laporan/neraca?as_of_date={date.today()}", headers=headers)
        if neraca_res.status_code != 200:
            print(f"Failed to get Neraca. Status: {neraca_res.status_code}, Body: {neraca_res.text}")
            return
        neraca = neraca_res.json()
        print(f"\nNeraca (Balance Sheet):")
        
        # Check if keys exist before accessing
        if 'aktiva_lancar' in neraca:
            print(f"   Piutang Jasa Angkut (Internal): {neraca['aktiva_lancar']['piutang_jasa_angkut']}")
            print(f"   Selisih (Balanced?): {neraca['selisih']}")
        else:
            print(f"   Error: 'aktiva_lancar' not found in Neraca response. Keys: {list(neraca.keys())}")
        
        mismatches = neraca.get('cross_validation', {}).get('mismatches', [])
        if mismatches:
            print("Mismatches found:")
            for m in mismatches:
                print(f"   Ref: {m['ref']}, P: {m['piutang']}, H: {m['hutang']}, Gap: {m['gap']}")
        else:
            print("No internal mismatches found.")

        # C. Laba Rugi
        lr_res = requests.get(f"{API_URL}/api/v1/laporan/laba-rugi?tanggal_dari=2024-01-01&tanggal_sampai={date.today()}", headers=headers)
        if lr_res.status_code != 200:
            print(f"Failed to get Laba Rugi. Status: {lr_res.status_code}, Body: {lr_res.text}")
            return
        lr = lr_res.json()
        print(f"\nLaba Rugi (Consolidated):")
        if 'units' in lr and 'jasa_angkut' in lr['units']:
            ja_unit = lr['units']['jasa_angkut']
            print(f"   Pendapatan JA: {ja_unit['revenue']}")
            print(f"   Biaya Operasional JA: {ja_unit['beban_operasional']}")
            print(f"   Maintenance JA: {ja_unit['maintenance']}")
            print(f"   Laba Bersih JA: {ja_unit['laba_bersih']}")
        
        print(f"   Laba Operasional Konsolidasi: {lr['summary']['laba_operasional']}")
        print(f"   Laba Bersih Akhir: {lr['summary']['laba_bersih']}")

        print("\nTest Completed!")

    except Exception as e:
        print(f"Test failed: {e}")
        if hasattr(e, 'response') and e.response:
            print(f"Response: {e.response.text}")

if __name__ == "__main__":
    run_test()
