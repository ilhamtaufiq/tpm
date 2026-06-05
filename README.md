# TPM Super App

TPM Super App adalah aplikasi operasional internal untuk **Tiga Putra Motor**. Sistem ini menggabungkan workflow bengkel, jual beli mobil, jasa angkut, SDM, kas, hutang/piutang, dan laporan keuangan dalam satu aplikasi.

## Ringkasan Aplikasi

Aplikasi ini dibangun sebagai ERP ringan untuk operasional harian:

- **Bengkel:** antrian kerja, open bill service/sparepart, pembayaran, riwayat order, stok sparepart, pembelian part, cetak order slip dan struk.
- **Jual Beli Mobil:** master mobil, pembelian/stok unit, penjualan mobil, biaya persiapan, investor, dan pelacakan status unit.
- **Jasa Angkut:** armada, supir, muatan, biaya operasional perjalanan, status muatan, dan piutang jasa angkut.
- **Keuangan:** mutasi kas/bank, kas unit operasional, hutang, piutang, modal, pengeluaran, pencairan investor, dan rekonsiliasi laporan.
- **SDM:** karyawan, absensi, kasbon, dan slip gaji.
- **Master Data:** customer, supplier, sparepart, jasa servis, asset, user, dan pengaturan aplikasi.

## Tech Stack

### Backend

- **Runtime:** Python 3.11
- **Framework:** FastAPI
- **Database:** MySQL
- **ORM:** SQLAlchemy 2
- **Migration:** Alembic
- **Validation:** Pydantic v2
- **Auth:** JWT Bearer Token dengan `python-jose` dan `passlib`
- **File Upload:** FastAPI static files pada upload directory
- **Export/Print:** ReportLab, OpenPyXL, XlsxWriter, Pillow
- **Testing:** Pytest, HTTPX

### Frontend

- **Framework:** React Native 0.76 dengan Expo 52
- **Routing:** Expo Router
- **Web Target:** React Native Web
- **State/API:** Axios, TanStack Query, Zustand
- **Storage:** AsyncStorage, SecureStore
- **UI:** NativeWind, Tailwind CSS, Lucide React Native, Gorhom Bottom Sheet
- **Device Features:** Expo Camera, Document Picker, Image Picker, Print, Sharing, Notifications, Local Authentication
- **Receipt/Slip:** Expo Print, QR Code SVG, thermal receipt printer package

### Infrastruktur

- **Local dev:** backend FastAPI + frontend Expo dev server
- **Database local:** MySQL/Laragon atau MySQL native
- **Container support:** `docker-compose.yml` tersedia untuk MySQL, backend, frontend Nginx, dan Cloudflare Tunnel
- **Production domain default frontend:** `https://tpm.cianjur.space`

## Arsitektur

```text
tpm/
+-- backend/
|   +-- app/
|   |   +-- api/v1/       # endpoint FastAPI per modul
|   |   +-- models/       # model SQLAlchemy
|   |   +-- schemas/      # schema Pydantic
|   |   +-- services/     # business logic dan integrasi finansial
|   |   +-- middleware/   # CORS, logging, error handler
|   |   +-- realtime/     # realtime manager
|   +-- alembic/          # database migrations
|   +-- uploads/          # file upload/static
+-- frontend/
|   +-- app/              # screen dan route Expo Router
|   +-- components/       # komponen UI reusable
|   +-- hooks/            # hook TanStack Query
|   +-- services/         # client API
|   +-- store/            # Zustand stores
|   +-- types/            # TypeScript types
|   +-- utils/            # formatter/helper
+-- deploy/               # deployment assets
+-- desktop-template/     # template packaging desktop
+-- tests/                # test tambahan
```

## Modul Backend Utama

Endpoint backend berada di `backend/app/api/v1/`.

- `auth.py`: login, token, dan autentikasi.
- `customers.py`, `suppliers.py`: master customer dan supplier.
- `spare_parts.py`, `jasa_servis.py`: master item bengkel.
- `transaksi_bengkel.py`: antrian, update order, pembayaran, dan riwayat bengkel.
- `pembelian_parts.py`: pembelian sparepart dan stok.
- `mobil.py`, `penjualan_mobil.py`: stok dan penjualan mobil.
- `muatan.py`, `armada.py`, `supir.py`: workflow jasa angkut.
- `kas_bank.py`, `piutang.py`, `hutang.py`, `pengeluaran.py`: modul finansial.
- `laporan.py`: laporan laba rugi, neraca, perubahan modal, dan laporan unit.
- `karyawan.py`, `absensi.py`, `kasbon.py`, `slip_gaji.py`: modul SDM.
- `settings.py`, `backup.py`, `trash.py`, `security.py`: konfigurasi, backup, recycle bin, dan keamanan.
- `public_receipt.py`, `public_gallery.py`: akses publik untuk receipt/gallery.
- `realtime.py`, monitor endpoint: observability dan realtime update.

## Alur Bisnis

### 1. Bengkel

Flow bengkel memakai konsep antrian dan open bill.

1. User membuat **Antrian Bengkel** dari form bengkel.
2. Antrian belum otomatis masuk transaksi keuangan dan belum membuat pembayaran.
3. User dapat menambahkan pre-order jasa servis atau sparepart sejak pembuatan antrian.
4. Order dapat dicetak sebagai **Order Slip**.
5. Dari menu transaksi bengkel, user mengupdate order yang sama dengan menambah service/sparepart.
6. Jika item yang sama ditambahkan beberapa kali, review order menggabungkan kuantitas menjadi `x1`, `x2`, dan seterusnya.
7. User bisa simpan update transaksi tanpa pembayaran.
8. Jika user memilih lanjut pembayaran, bottom sheet pembayaran muncul.
9. Pembayaran mendukung nominal bayar dan diskon dengan format input Rupiah.
10. Setelah pembayaran selesai, status pengerjaan menjadi **Selesai**.

Catatan finansial bengkel:

- Status **Antre/Proses** tidak boleh membuat record keuangan Rp0.
- Order bengkel baru masuk alur finansial ketika ada pembayaran/pelunasan atau ketika aturan bisnis memang mengharuskan pencatatan piutang.
- Kasus **Selesai tetapi belum bayar** harus diperlakukan sebagai tagihan/piutang, bukan laba tunai.

### 2. Jual Beli Mobil

1. Unit mobil dicatat ke master/stok mobil.
2. Biaya pembelian, biaya persiapan, dan biaya terkait unit dicatat untuk menghitung modal unit.
3. Penjualan mobil menyelesaikan status unit dan mencatat transaksi finansial sesuai metode pembayaran.
4. Investor dan pencairan investor dikelola dari modul finance jika transaksi terkait investor.
5. Laporan penjualan mobil membaca data dari transaksi mobil dan mutasi finansial terkait.

### 3. Jasa Angkut

1. Master armada dan supir disiapkan.
2. User membuat muatan dengan informasi customer, armada, supir, asal/tujuan, dan nilai jasa.
3. Biaya operasional perjalanan dapat dicatat sebagai pengeluaran unit jasa angkut.
4. Muatan internal seperti kebutuhan operasional internal tidak diperlakukan sebagai pendapatan eksternal.
5. Muatan selesai dan pembayaran/piutang mempengaruhi laporan jasa angkut serta laporan keuangan.

### 4. Keuangan

Modul keuangan menjadi sumber utama untuk kas, bank, hutang, piutang, modal, dan laporan.

- **Mutasi Kas/Bank:** mencatat arus kas masuk dan keluar.
- **Kas Unit Operasional:** memisahkan kas unit seperti bengkel, jasa angkut, dan mobil.
- **Piutang:** tagihan customer yang belum lunas.
- **Hutang:** hutang pembelian part, mobil, investor, atau hutang manual.
- **Pengeluaran:** biaya operasional dan biaya unit.
- **Laporan:** laba rugi, neraca, perubahan modal, penjualan/pembelian, dan stok.

Prinsip penting:

- Jangan mencatat pendapatan hanya karena order dibuat.
- Transaksi antre/proses belum dianggap realisasi finansial.
- Laporan neraca harus seimbang antara aktiva dan pasiva.
- Pendapatan tunai, piutang, hutang, modal, dan laba ditahan harus berasal dari sumber transaksi yang konsisten.

### 5. SDM

1. Data karyawan dibuat di master SDM.
2. Absensi dan kasbon dicatat per karyawan.
3. Slip gaji menghitung komponen payroll dan potongan kasbon.
4. Pembayaran gaji mempengaruhi mutasi kas/bank.

## Struktur Frontend

Route utama frontend berada di `frontend/app/`.

- `(auth)`: login, lupa password, OTP, reset password.
- `(security)`: PIN dan fitur keamanan.
- `(tabs)`: home, finance, history, profile.
- `bengkel`: dashboard bengkel, inventory, purchase, transaksi.
- `mobil`: jual beli mobil.
- `jasa-angkut`: dashboard, armada, supir, muatan.
- `finance`: akun, mutasi, piutang, hutang, pengeluaran, user cash, laporan, pencairan investor.
- `laporan`: laba rugi, neraca, perubahan modal, laporan penjualan/pembelian/stok.
- `master-data`: customer, supplier, sparepart, jasa servis, asset.
- `sdm`: karyawan, absensi, kasbon, slip gaji.
- `settings`: profile, password, theme, print, scanner, bluetooth, backup, users, SMTP, trash.
- `receipt`: halaman receipt publik/internal berdasarkan tipe dan ID.
- `monitor`: monitor request/API dari sisi frontend.

## API Base URL Frontend

Konfigurasi API ada di `frontend/utils/api.ts`.

- Web `localhost` atau `127.0.0.1` otomatis memakai `http://localhost:8000/api/v1`.
- Host `tpm.test` memakai `http://tpm.test:8000/api/v1`.
- Domain `*.cianjur.space` memakai protocol dan host yang sama.
- Fallback mobile/standalone memakai `https://tpm.cianjur.space/api/v1`.

Untuk test di HP fisik, pastikan base URL mengarah ke IP komputer lokal jika tidak memakai domain production.

## Setup Local Development

### Prasyarat

- Python 3.11
- Node.js 20+
- npm
- MySQL
- Git

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
alembic upgrade head
python seed_users.py
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend URL:

- API: `http://localhost:8000/api/v1`
- Swagger: `http://localhost:8000/docs`
- Monitor: `http://localhost:8000/monitor`

### Frontend

```bash
cd frontend
npm install
npm start
```

Command lain:

```bash
npm run web
npm run android
npm run ios
```

### Start Bersamaan di Windows

```powershell
.\start-local.ps1
```

Script ini menjalankan backend di `http://localhost:8000` dan frontend Expo web dev server.

## Environment Backend

Contoh `backend/.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=tpm_db
DB_USER=root
DB_PASSWORD=
APP_NAME=TPM Backend
DEBUG=True
ENVIRONMENT=development
JWT_SECRET_KEY=change-this-secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
UPLOAD_DIR=uploads
CORS_ORIGINS=http://localhost:3000,http://localhost:8081,http://127.0.0.1:3000,http://127.0.0.1:8081
```

Sesuaikan kredensial database dengan setup MySQL lokal.

## Docker

`docker-compose.yml` menyediakan service:

- `db`: MySQL 8 pada host port `3307`.
- `backend`: FastAPI pada port `8000`.
- `frontend`: build web frontend dengan Nginx pada port `80`.
- `tunnel`: Cloudflare Tunnel, membutuhkan `CLOUDFLARE_TUNNEL_TOKEN`.

Jalankan hanya jika memang memakai workflow container:

```bash
docker compose up -d --build
```

## Akun Seed

Jika menjalankan `backend/seed_users.py`, akun awal biasanya dibuat untuk kebutuhan development. Cek script tersebut sebelum memakai di production dan ubah password default.

## Aturan Pengembangan

- Letakkan business logic backend di `backend/app/services/`, bukan langsung di route.
- Route API bertugas menerima request, validasi, auth, dan memanggil service.
- Frontend akses backend melalui `frontend/services/` dan hook di `frontend/hooks/`.
- Semua nilai uang harus konsisten memakai formatter Rupiah di UI dan tipe numerik di API.
- Perubahan alur finansial harus dicek dampaknya ke kas/bank, piutang, hutang, laba rugi, neraca, dan perubahan modal.
- Jangan membuat record keuangan Rp0 untuk proses/antrian yang belum menjadi transaksi finansial.
- Gunakan Alembic untuk perubahan schema database.
- Jangan simpan credential production di repo.

## Verifikasi Umum

Backend:

```bash
cd backend
python -m py_compile app/main.py
pytest
```

Frontend:

```bash
cd frontend
npx tsc --noEmit
npm run web
```

Untuk perubahan UI, buka screen terkait dan cek flow manual. Untuk perubahan finansial, uji minimal satu transaksi per modul yang terdampak dan cocokkan laporan.
