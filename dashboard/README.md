# TPM Monitoring Dashboard

Dashboard web read-only untuk owner/manager. Data dari backend FastAPI yang sama
dengan aplikasi mobile. Tidak ada mutasi finansial dari sini.

## Stack

Vite + React + TypeScript + Tailwind + TanStack Query + Recharts + react-router-dom.

## Jalankan lokal

```bash
cd dashboard
cp .env.example .env   # sesuaikan VITE_API_BASE_URL ke backend
npm install
npm run dev            # http://localhost:5173
```

Backend harus jalan (`uvicorn app.main:app --reload --port 8000` dari `backend/`),
lalu login dengan akun role ADMIN / MANAGER.

## Struktur

```
src/
  api/client.ts      # axios + JWT (localStorage tpm_dashboard_token)
  api/services.ts    # service read-only per domain
  hooks/             # useDashboard (summary/activity/alerts), useRealtime (WS)
  store/auth.tsx     # sesi + guard role
  components/        # Layout nav + ui (Card/Kpi/Badge)
  pages/             # Login, Overview, Transaksi, Reports, Domains
  utils/format.ts    # Rupiah + tanggal id-ID (port frontend/utils/format.ts)
```
