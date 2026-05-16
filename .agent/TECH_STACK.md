# Technical Stack & Architecture

## 1. Backend
### Teknologi
- FastAPI
- Python 3.x
- SQLAlchemy 2.x style mapped models
- MySQL
- Pydantic schemas untuk kontrak API

### Struktur Utama
- `app/api/`: router utama dan endpoint REST.
- `app/models/`: entitas database.
- `app/schemas/`: request/response schema.
- `app/services/`: business logic.
- `app/services/reports/`: mesin laporan konsolidasi.
- `app/utils/`: enum, helper, cache, security.
- `app/middleware/`: auth, cors, logging, error handler.

### Pola Arsitektur
- Router tipis, service tebal.
- Ledger keuangan dipusatkan di service keuangan dan helper integrasi.
- Perhitungan laporan lintas unit dipusatkan di report services.
- Static upload dan asset app dimount dari `main.py`.
- API memakai prefix `/api/v1`.

## 2. Frontend
### Teknologi
- Expo 52 / React Native 0.76
- Expo Router
- TanStack Query
- Zustand
- NativeWind
- Axios
- AsyncStorage
- Expo Updates

### Struktur Utama
- `app/`: route dan screen.
- `services/`: wrapper API per domain.
- `store/`: state global.
- `components/`: komponen UI bersama.
- `utils/`: helper format dan utilitas lain.
- `assets/`: logo/font/gambar.

## 3. Domain Utama di Backend
- Auth & user
- Master data
- Bengkel
- Mobil
- Jasa Angkut
- SDM
- Finance
- Reports
- Security/settings
- Backup/trash/monitoring

Router yang saat ini terdaftar dapat dilihat di `backend/app/api/router.py`.

## 4. Utilities Penting
- `backend/app/utils/constants.py`: source of truth untuk enum sistem.
- `backend/app/services/kas_bank_integration.py`: routing akun kas/bank otomatis.
- `frontend/utils/format.ts`: format angka/tanggal.
- `frontend/app/_layout.tsx`: root frontend behavior (query config, OTA, security routing, splash handling).

## 5. Deployment & Runtime Notes
- Backend menyediakan static uploads dan endpoint monitor.
- Frontend mendukung Android, iOS, dan web.
- OTA update dikonfigurasi di `frontend/app.json`.
- `frontend/package.json` memuat script Expo standar dan dependency printer/receipt yang relevan dengan aplikasi operasional.

## 6. Prinsip Teknis
- Enum dulu, string literal belakangan hanya jika benar-benar perlu.
- Business rule sebaiknya hidup di service, bukan tercecer di UI.
- Dokumentasi harus mengikuti kode aktual, terutama untuk finance/reporting yang cepat drift.
