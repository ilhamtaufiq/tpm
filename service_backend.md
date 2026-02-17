# Dokumentasi Service TPM Backend (Systemd)

`tpm-app-backend` adalah service Systemd yang mengelola proses backend API (FastAPI/Uvicorn) di VPS. Service ini memastikan aplikasi berjalan di background, restart otomatis jika crash, dan auto-start saat server booting.

## 📌 Lokasi & Info
- **File Service**: `/etc/systemd/system/tpm-app-backend.service`
- **Direktori App**: `/var/www/html/tpm/backend`
- **Virtual Environment**: `/var/www/html/tpm/backend/venv`
- **User**: `olobor` (atau user non-root lain di VPS)

## ⚙️ Perintah Utama (Manajemen Service)

Gunakan perintah berikut dengan `sudo`:

| Perintah | Fungsi | Kapan Digunakan? |
| :--- | :--- | :--- |
| `sudo systemctl start tpm-app-backend` | Menjalankan backend | Jika service mati/belum jalan. |
| `sudo systemctl stop tpm-app-backend` | Mematikan backend | Menghentikan sementara untuk maintenance. |
| `sudo systemctl restart tpm-app-backend` | Restart ulang backend | **Wajib** setiap kali ada perubahan kode Python atau file `.env`. |
| `sudo systemctl status tpm-app-backend` | Cek status & error | Melihat apakah service `active (running)` atau error. |
| `sudo systemctl enable tpm-app-backend` | Auto-start saat boot | Agar backend nyala otomatis setelah VPS restart. |

## 📜 Cara Melihat Log (Debugging)

Jika terjadi error 500 atau aplikasi tidak bisa diakses, cek log berikut:

### 1. Lihat Log Real-time (Recommended)
Melihat log yang terus berjalan (seperti `tail -f`). Tekan `Ctrl+C` untuk keluar.
```bash
sudo journalctl -u tpm-app-backend -f
```

### 2. Lihat 50 Log Terakhir
Cepat melihat snapshot log terakhir tanpa menunggu update.
```bash
sudo journalctl -u tpm-app-backend -n 50 --no-pager
```

## 🛠 Struktur File Service
Isi file `/etc/systemd/system/tpm-app-backend.service` biasanya seperti berikut:

```ini
[Unit]
Description=Gunicorn instance to serve tpm-app Backend
After=network.target

[Service]
# User yang menjalankan aplikasi (bukan root demi keamanan)
User=olobor
Group=olobor

# Direktori kerja
WorkingDirectory=/var/www/html/tpm/backend

# Environment Variable & Path Venv
Environment="PATH=/var/www/html/tpm/backend/venv/bin:/usr/bin"
# Executable
ExecStart=/var/www/html/tpm/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 3

[Install]
WantedBy=multi-user.target
```

## ⚠️ Masalah Umum & Solusi

### 1. `Failed to restart tpm-app-backend.service: Unit not found`
**Penyebab:** Script deploy belum dijalankan atau file service terhapus.
**Solusi:** Jalankan ulang `./deploy-vps.sh` atau buat file service manual seperti di atas.

### 2. Status `Activate: periodic restart` (Looping Crash)
**Penyebab:** Ada error di kode Python yang membuat aplikasi langsung crash begitu dimulai (misal error sintaks atau koneksi DB gagal).
**Solusi:** Jalankan `sudo journalctl -u tpm-app-backend -f` untuk melihat pesan error spesifik Python.

### 3. `Address already in use`
**Penyebab:** Port 8000 masih dipakai proses lain yang nyangkut.
**Solusi:** Kill proses lama: `sudo fuser -k 8000/tcp` lalu start lagi service-nya.

### 4. `ModuleNotFoundError: No module named 'xxx'`
**Penyebab:** Library belum terinstall di virtualenv.
**Solusi:**
1. Masuk direktori: `cd backend`
2. Aktifkan venv: `source venv/bin/activate`
3. Install: `pip install -r requirements.txt`
4. Restart service.
