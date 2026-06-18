# TPM (Tiga Putra Motor) Super App

[![Backend Tech](https://img.shields.io/badge/Backend-FastAPI-009688.svg?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Frontend Tech](https://img.shields.io/badge/Frontend-Expo%20%2F%20React%20Native-000000.svg?style=flat-square&logo=expo)](https://expo.dev/)
[![Database](https://img.shields.io/badge/Database-MySQL-4479A1.svg?style=flat-square&logo=mysql)](https://www.mysql.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg?style=flat-square)](#)

TPM Super App adalah sistem Enterprise Resource Planning (ERP) mini-monolitik lintas platform yang dirancang untuk mengintegrasikan seluruh operasional bisnis internal **Tiga Putra Motor (TPM)**. Sistem ini menghubungkan operasional lapangan (bengkel, angkutan, logistik) dengan pembukuan akuntansi keuangan terpadu, manajemen SDM, dan analitik performa bisnis secara real-time.

---

## 📌 Daftar Bisnis & Alur Nilai (Business Domain)

Sistem ini membagi operasional bisnis ke dalam 5 domain fungsional yang saling terintegrasi:

| Domain Bisnis | Fungsi Operasional (Untuk Pengguna) | Dampak Finansial (Untuk Pengembang / Akuntan) |
| :--- | :--- | :--- |
| **🏪 Bengkel (Workshop)** | Pendaftaran antrian mekanik, Surat Perintah Kerja (SPK), pengelolaan stok sparepart otomatis, kasir/kasir kilat, serta cetak struk via thermal printer. | Pengurangan stok sparepart real-time, pencatatan HPP (Harga Pokok Penjualan), pengakuan piutang (jika belum lunas), dan komisi servis untuk slip gaji mekanik. |
| **🚗 Jual Beli Mobil** | Pencatatan unit mobil masuk, kalkulasi biaya perbaikan/persiapan unit, manajemen investor modal patungan, status pemasaran (Stok/Booked/Terjual). | Pengakuan Aset (Inventori Mobil), kalkulasi Net Margin per Unit, pembagian profit otomatis dengan investor, dan tracking piutang pembeli. |
| **🚚 Jasa Angkut (Logistik)** | Penugasan supir dan armada truk, pembuatan manifes muatan barang, pelacakan rute perjalanan, dan pencatatan biaya operasional jalan (Solar, Tol, dll). | Perhitungan Laba Kotor per Ritase/Trip, pencatatan kasbon operasional supir, dan tagihan invoice (piutang usaha) ke customer korporat/eksternal. |
| **👥 SDM (HRM & Payroll)** | Database karyawan, rekam absensi harian terintegrasi, manajemen pengajuan kasbon karyawan, dan otomatisasi pembuatan slip gaji bulanan. | Pencatatan liabilitas (gaji yang harus dibayar), pemotongan otomatis saldo kasbon karyawan dari slip gaji, dan pencatatan biaya overhead gaji. |
| **💼 Keuangan (Finance)** | Pembuatan bagan akun (Chart of Accounts), pencatatan mutasi kas & bank, rekonsiliasi kas kasir (User Cash), pelacakan hutang-piutang jatuh tempo. | Pembuatan Neraca Saldo (Balance Sheet), Laporan Laba Rugi (Profit & Loss), Laporan Perubahan Modal, dan penegakan aturan double-entry balancing. |

---

## 🏛️ Arsitektur Sistem

Aplikasi ini menggunakan pola arsitektur **Client-Server decoupled monolit** dengan fokus pada performa lokal dan keandalan data finansial.

```text
               +--------------------------------------------------+
               |             React Native / Expo Client           |
               |  (Android / iOS / Web Single Page Application)   |
               +-----------------------+--------------------------+
                                       |
                     REST APIs         |    WebSockets
                   (HTTPS/JSON)        |   (Real-time State)
                                       v
               +--------------------------------------------------+
               |                  FastAPI Engine                  |
               |   (Router -> Auth Middleware -> Service Layer)   |
               +-----------------------+--------------------------+
                                       |
                                SQLAlchemy ORM
                                       |
                                       v
               +--------------------------------------------------+
               |                    MySQL DB                      |
               | (Double-Entry Ledger, Soft-Delete, Index Triggers)|
               +--------------------------------------------------+
```

### Struktur Repositori

```text
tpm/
├── backend/
│   ├── alembic/              # File migrasi database versi skema
│   └── app/
│       ├── api/              # HTTP Route endpoints (REST API)
│       │   └── v1/           # Endpoint per modul bisnis (auth, bengkel, mobil, dll)
│       ├── database/         # Koneksi DB, Base model SQLAlchemy, mixins
│       ├── middleware/       # CORS, Auth (JWT), Logging, Error handler
│       ├── models/           # Definisi skema tabel/relasi database SQL (SQLAlchemy 2.x)
│       ├── schemas/          # Validasi tipe request/response Pydantic v2
│       ├── services/         # Layer Logika Bisnis & Penghitungan Akuntansi
│       │   └── reports/      # Laporan Keuangan (Laba Rugi, Neraca, Modal)
│       ├── utils/            # Helper global (Constants, Cache, Email, Security)
│       └── realtime.py       # WebSocket real-time manager
├── frontend/
│   ├── app/                  # Router navigasi berbasis file (Expo Router v4)
│   ├── components/           # Komponen UI reusable
│   │   └── ui/               # UI Kit (Header, CustomTabBar, AppBottomSheet, dll)
│   ├── context/              # Context Providers (AlertContext)
│   ├── hooks/                # React Hooks TanStack Query (useBengkel, useMobil, useKeuangan, dll)
│   ├── services/             # HTTP Client endpoints adapter (Axios instance)
│   ├── store/                # State management (Zustand): auth, nav, UI, security, notifications, monitor
│   ├── constants/            # APP_ROUTES index untuk pencarian global
│   └── utils/                # Formatter Rupiah, helper QZ Tray, printer thermal, receipt templates
└── deploy/                   # Script deployment server & setup tunnel SSL
```

---

## ⚡ Alur Transaksi Utama (Workflows)

### 1. Siklus Hidup Transaksi Bengkel
```text
[Pendaftaran Antrian] ──> [Pembuatan SPK & Estimasi] ──> [Pengerjaan Mekanik]
                                                                │
[Laporan Keuangan] <── [Jurnal Akuntansi] <── [Pembayaran] <────┘
```
1. **Antrian (Queueing)**: Input registrasi kendaraan (Pelat nomor, Keluhan). Status: *Antre* atau *Proses*. **Tidak ada mutasi finansial Rp0 yang dicatat pada tahap ini.**
2. **Estimasi / SPK**: Mekanik mengalokasikan sparepart (mengurangi stok virtual sementara) dan menambahkan jasa servis.
3. **Penyelesaian Order & Pembayaran**: Kasir menutup transaksi:
   - Jika **Lunas**: Mengurangi stok fisik, mencatat Kas Masuk, mencatat HPP, dan mengakui Pendapatan Servis.
   - Jika **Belum Lunas (Piutang)**: Mengakui Piutang Usaha atas nama pelanggan dan HPP tetap tercatat. Status pengerjaan berubah menjadi *Selesai*.
   - Transaksi yang sudah terbayar **tidak boleh dihapus** melainkan di-*void* via Reversal Ledger.

### 2. Logika Unit Jual Beli Mobil
1. **Capitalization**: Mobil dibeli dan diklasifikasikan sebagai persediaan/aset lancar. Harga beli masuk sebagai nilai buku awal.
2. **Upkeep (Biaya Persiapan)**: Pengeluaran untuk perbaikan, cuci, salon, atau sparepart untuk unit mobil tersebut secara otomatis dikapitalisasi menambah nilai buku aset mobil tersebut (menaikkan harga pokok unit).
3. **Joint Venture (Konsorsium Investor)**: Pencatatan porsi modal dari investor eksternal per unit mobil.
4. **Disposal (Penjualan)**: Mobil terjual secara tunai/kredit. Sistem menghitung:
   `Margin Kotor = Harga Jual - (Harga Beli + Total Biaya Persiapan)`
   Profit bersih dibagikan secara otomatis ke saldo kas masing-masing investor sesuai persentase kepemilikan modal yang tercatat.

---

## ⚖️ Aturan & Invariant Finansial (Critical Rules)

Untuk menjaga akurasi laporan akuntansi, setiap pengembang wajib mengikuti aturan invariant database berikut:

1. **Anti Rp0 Transaksi Finansial**: Dilarang membuat jurnal entri kas/bank atau piutang dengan nominal Rp0 pada database.
2. **Prinsip Double-Entry**: Setiap mutasi kas masuk/keluar harus memiliki akun lawan yang seimbang. Total Aktiva (Aset/Kas/Piutang) pada neraca harus selalu sama dengan Pasiva (Kewajiban/Hutang + Modal + Laba Ditahan).
3. **Immutability Jurnal**: Transaksi yang telah memiliki nomor referensi jurnal akuntansi tidak boleh di-`DELETE` secara fisik dari database. Jika terjadi kesalahan input atau pembatalan transaksi, wajib menggunakan mekanisme **Reversal Transaction** (jurnal balik) untuk menihilkan efek nominalnya.
4. **Integrasi Kasir Mandiri (User Cash)**: Setiap transaksi kasir wajib terikat dengan sesi kas kasir yang aktif (`user_cash`). Kasir tidak bisa bertransaksi jika belum melakukan pembukaan kas awal, dan harus melakukan rekonsiliasi (tutup kas) di akhir shift.

---

## 🔒 Keamanan & Kontrol Akses

### PIN & Biometric Authentication
Sistem memiliki lapisan keamanan berbasis **PIN** dan **biometric** (fingerprint/face ID via `expo-local-authentication`):
- **App Lock**: Kunci seluruh aplikasi saat di-background (kecuali mode DEV).
- **Feature-Level Protection**: Admin dapat mengaktifkan PIN per modul (Finance, Reports, Settings, dll.).
- **Biometric**: Opsi login dengan sidik jari/wajah.
- Status keamanan disinkronkan dari backend ke `useSecurityStore` via API.
- Route guard di `app/_layout.tsx` mengarahkan ke halaman PIN (`/(security)/pin`) jika fitur terkunci.

### Impersonation Mode
Admin/Manager dapat login sebagai user lain untuk troubleshooting tanpa perlu tahu password mereka. Mode impersonasi ditandai dengan banner kuning di Header dan tombol "Stop" untuk kembali ke sesi admin asli.

---

## 🔄 Sinkronisasi Real-Time & Offline

### WebSocket Real-Time Sync
Notifikasi real-time dikirim dari backend via WebSocket (`backend/app/realtime.py`) dan diterima frontend via `frontend/services/realtime.ts`. Event meliputi:
- Transaksi bengkel baru
- Perubahan status pembayaran
- Update stok sparepart

### Offline Cache (TanStack Query Persist)
Frontend menggunakan `@tanstack/react-query-persist-client` dengan `AsyncStorage` sebagai backend penyimpanan offline:
- **Stale time**: 10 detik (near real-time).
- **GC time**: 24 jam.
- **Retry**: 2 kali (kecuali network error).
- Data di-refetch otomatis saat koneksi kembali (`refetchOnReconnect`).

### Connectivity Banner
`ConnectivityBanner` (frontend) menampilkan indikator online/offline di atas konten ketika koneksi terputus.

---

## 🧭 Navigasi Dinamis (CustomTabBar)

Sistem memiliki **CustomTabBar** yang dapat dikonfigurasi oleh user:
- **5 slot navigasi utama**: home, bengkel, fab-plus, angkut, mobil (default).
- **3 slot FAB radial**: shortcut cepat yang muncul saat menekan tombol + di tengah tab bar.
- **Slot per halaman (pageFabSlots)**: shortcut berbeda muncul tergantung halaman aktif (bengkel/mobil/angkut).
- Role **BENGKEL** mendapat layout khusus: Home, Inventori, FAB+, Master Data, Absensi.
- Semua konfigurasi tersimpan di `useNavigationStore` (persisted via AsyncStorage).

---

## 🛠️ Panduan Instalasi Lokal (Local Setup)

### Prasyarat System
- Python `3.11.x`
- Node.js `20.x` atau lebih tinggi
- MySQL Server `8.0` atau `MariaDB 10.4+`

### 1. Konfigurasi Database & Backend
1. Masuk ke folder backend dan buat virtual environment:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # Di Windows: venv\Scripts\activate
   ```
2. Instal pustaka dependensi:
   ```bash
   pip install -r requirements.txt
   ```
3. Salin konfig file env dan sesuaikan kredensial MySQL lokal Anda:
   ```bash
   copy .env.example .env
   ```
   Isi konfigurasi database di `.env`:
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=tpm_db
   DB_USER=root
   DB_PASSWORD=yourpassword
   DEBUG=True
   JWT_SECRET_KEY=generate-secure-random-key-here
   ```
4. Jalankan migrasi skema database menggunakan Alembic:
   ```bash
   alembic upgrade head
   ```
5. Buat data pengguna awal (Seeder):
   ```bash
   python seed_users.py
   ```
6. Jalankan server backend FastAPI:
   ```bash
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```
   - **Interactive API Docs**: Buka [http://localhost:8000/docs](http://localhost:8000/docs) (Swagger UI)
   - **System Performance Monitor**: Buka [http://localhost:8000/monitor](http://localhost:8000/monitor)

### 2. Konfigurasi & Menjalankan Frontend
1. Masuk ke folder frontend dan instal dependensi Node:
   ```bash
   cd frontend
   npm install
   ```
2. Jalankan Expo bundler server:
   ```bash
   npm start
   ```
3. **Pilihan Target Device**:
   - Tekan `w` untuk membuka versi Web di browser.
   - Tekan `a` untuk emulator Android atau `i` untuk iOS simulator.
   - Scan QR Code menggunakan aplikasi Expo Go di smartphone fisik Anda (pastikan device dan komputer berada dalam satu jaringan Wi-Fi yang sama).

---

## 🖨️ Integrasi Hardware (Thermal Printer & QZ Tray)

Sistem ini mendukung pencetakan struk dan Surat Perintah Kerja (SPK) langsung ke printer thermal (Lokal USB / Network / Bluetooth) menggunakan protokol **QZ Tray**.

1. Konfigurasi tipe printer dilakukan di halaman **Settings -> Printer settings** pada frontend.
2. Untuk environment web desktop, pastikan aplikasi **QZ Tray** terinstal dan berjalan di latar belakang komputer kasir agar Web Client dapat berkomunikasi dengan port printer fisik.
3. Struktur data cetak dikelola di `frontend/utils/qzTray.web.ts` dan jenis data struk thermal di `frontend/utils/qzTray.types.ts`.

---

## 🐳 Containerization (Docker)

Untuk deployment instan ke server VPS testing atau production, gunakan konfigurasi Docker Compose yang telah disediakan di root directory:

```bash
docker compose up -d --build
```

Docker compose akan menjalankan 4 kontainer utama:
1. **db**: MySQL 8 database service (Port `3307` binding ke host).
2. **backend**: Aplikasi FastAPI FastAPI (Port `8000`).
3. **frontend**: Web client yang dibuild static dan dideploy via Nginx (Port `80`).
4. **tunnel**: Cloudflare Tunnel Agent untuk mengekspos API & Web secara aman dengan SSL HTTPS otomatis tanpa membuka port firewall publik.

---

## 📝 Aturan Pengembangan (Dev Guidelines)

1. **Business Logic Isolation**: Dilarang keras menulis query database, manipulasi model finansial, atau kalkulasi harga langsung di dalam file route controller (`api/v1/endpoints/`). Logika bisnis wajib dibungkus dalam service class di dalam folder `app/services/`.
2. **Schema Validation**: Setiap data masuk dari frontend wajib divalidasi menggunakan skema Pydantic v2 di folder `app/schemas/` sebelum diproses oleh ORM SQLAlchemy.
3. **Database Changes**: Semua modifikasi kolom, tabel, atau tipe data index pada database wajib melalui file migrasi Alembic baru:
   ```bash
   alembic revision --autogenerate -m "deskripsi_perubahan"
   alembic upgrade head
   ```
4. **Immutability Pattern (Frontend Store)**: Pada frontend client, dilarang melakukan mutasi state global Zustand secara langsung. Gunakan function dispatcher yang mengembalikan salinan state baru (immutable pattern) sesuai standard `coding-style.md`.
5. **Code-first Models**: Gunakan SQLAlchemy 2.x `Mapped`/`mapped_column` style. Semua skema ditentukan di `app/models/` -- pastikan enum ditambahkan ke `app/utils/constants.py` agar tercakup di migrasi autogenerate Alembic.
6. **Anti Rp0 Transaksi Finansial**: Dilarang membuat jurnal entri kas/bank atau piutang dengan nominal Rp0 pada database.
7. **Prinsip Double-Entry**: Setiap mutasi kas masuk/keluar harus memiliki akun lawan yang seimbang. Total Aktiva (Aset/Kas/Piutang) pada neraca harus selalu sama dengan Pasiva (Kewajiban/Hutang + Modal + Laba Ditahan).
8. **Immutability Jurnal**: Transaksi yang telah memiliki nomor referensi jurnal akuntansi tidak boleh di-`DELETE` secara fisik dari database. Jika terjadi kesalahan input atau pembatalan transaksi, wajib menggunakan mekanisme **Reversal Transaction** (jurnal balik) untuk menihilkan efek nominalnya.
9. **Integrasi Kasir Mandiri (User Cash)**: Setiap transaksi kasir wajib terikat dengan sesi kas kasir yang aktif (`user_cash`). Kasir tidak bisa bertransaksi jika belum melakukan pembukaan kas awal, dan harus melakukan rekonsiliasi (tutup kas) di akhir shift.
