---
tags: [tpm, arsitektur, setup]
---

# TPM — Arsitektur & Setup

⬅️ [[CLAUDE|Kembali ke Hub]]

## Arsitektur

```
React Native/Expo Client (Android/iOS/Web)
        │  REST (HTTPS/JSON)  +  WebSocket
        ▼
FastAPI Engine (Router → Auth Middleware → Service Layer)
        │  SQLAlchemy ORM
        ▼
MySQL DB (Double-Entry Ledger, Soft-Delete, Index Triggers)
```

## Struktur Repositori

| Path | Isi |
|---|---|
| `backend/alembic/` | Migrasi skema database |
| `backend/app/api/v1/` | REST endpoints per modul bisnis |
| `backend/app/services/` | Logika bisnis & kalkulasi akuntansi |
| `backend/app/services/reports/` | Laporan keuangan (Laba Rugi, Neraca, Modal) |
| `backend/app/models/` | Skema tabel SQLAlchemy 2.x |
| `backend/app/schemas/` | Validasi Pydantic v2 |
| `backend/app/middleware/` | CORS, Auth JWT, Logging, Error handler |
| `backend/app/utils/` | Constants, Cache, Email, Security |
| `backend/app/realtime.py` | WebSocket manager |
| `frontend/app/` | Router berbasis file (Expo Router v4) |
| `frontend/components/ui/` | UI Kit (Header, CustomTabBar, AppBottomSheet) |
| `frontend/hooks/` | TanStack Query hooks per modul |
| `frontend/store/` | Zustand: auth, nav, UI, security, notifications, monitor |
| `frontend/services/offlineQueue/` | Offline write queue durable |
| `frontend/utils/` | Formatter Rupiah, QZ Tray helper, receipt templates |
| `deploy/apache/` | Config deployment server |
| `docs/CODEMAPS/` | ⏳ belum dibaca — kemungkinan peta kode/arsitektur tambahan |
| `.claude/`, `mcps/` | Config & MCP server khusus AI agent |

## Setup Lokal

**Backend**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
copy .env.example .env   # isi DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, JWT_SECRET_KEY
alembic upgrade head
python seed_users.py
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
Docs: `http://localhost:8000/docs` · Monitor: `http://localhost:8000/monitor`

**Frontend**
```bash
cd frontend
npm install
npm start   # w = web, a = android, i = ios
```

**Docker (all-in-one)**
```bash
docker compose up -d --build
```
Container: `db` (MySQL 8, port 3307) · `backend` (8000) · `frontend` (nginx, port 80) · `tunnel` (Cloudflare Tunnel, SSL otomatis tanpa buka port publik).

## Hardware — Thermal Printer (QZ Tray)

- Cetak struk & SPK ke printer thermal (USB/Network/Bluetooth) via protokol **QZ Tray**.
- Config: Settings → Printer settings (frontend).
- Perlu aplikasi QZ Tray berjalan di background komputer kasir untuk web client.
- Kode: `frontend/utils/qzTray.web.ts` (logika) & `qzTray.types.ts` (tipe data struk).

## Sinkronisasi Real-Time & Offline

- **Realtime**: WebSocket backend (`realtime.py`) ↔ frontend (`services/realtime.ts`). Event: transaksi bengkel baru, perubahan status pembayaran, update stok.
- **Cache baca**: TanStack Query Persist + AsyncStorage (`TPM_OFFLINE_CACHE`) — stale 10 detik, GC 24 jam, maxAge 7 hari, `networkMode: offlineFirst`, refetch otomatis saat reconnect. Laporan berat tidak di-persist.
- **Write queue tulis (durable)**: Zustand + AsyncStorage (`TPM_OFFLINE_WRITE_QUEUE_V1`) di `frontend/services/offlineQueue/`. Enqueue via `offlineAwareWrite`/`enqueueOfflineAction` (Idempotency-Key). Sync worker FIFO saat online/foreground, retry bounded, 4xx = failed permanen sampai user retry/hapus manual. UI: `ConnectivityBanner` + `OfflineQueueSheet`.

## Keamanan

- PIN + biometric (`expo-local-authentication`); App Lock saat app di-background (kecuali mode DEV).
- Proteksi per-fitur (Finance, Reports, Settings) via `useSecurityStore`; route guard di `app/_layout.tsx` → redirect ke `/(security)/pin`.
- **Impersonation Mode**: Admin/Manager bisa login sebagai user lain tanpa tahu password (untuk troubleshooting) — ditandai banner kuning + tombol "Stop".

## Navigasi Dinamis (CustomTabBar)

- 5 slot navigasi utama: home, bengkel, fab-plus, angkut, mobil (default).
- 3 slot FAB radial (shortcut saat tombol + ditekan).
- Slot per halaman (`pageFabSlots`) — shortcut beda tergantung halaman aktif.
- Role **BENGKEL** dapat layout khusus: Home, Inventori, FAB+, Master Data, Absensi.
- Config tersimpan di `useNavigationStore` (persisted AsyncStorage).

⬅️ [[CLAUDE|Kembali ke Hub]]
