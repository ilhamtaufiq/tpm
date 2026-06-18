# TPM Project Codemap Index

**Last Updated:** 2026-06-17

## Architecture Overview

TPM (Tiga Putra Motor) is a mini-monolithic ERP system with a React Native/Expo frontend and FastAPI backend connected to MySQL. Architecture follows a decoupled client-server monolith (REST + WebSockets).

```
[Expo Client (Android/iOS/Web)] --REST/WS--> [FastAPI Engine] --SQLAlchemy--> [MySQL DB]
```

## Codemap Areas

| Area | File | Description |
|------|------|-------------|
| Frontend | [FRONTEND.md](FRONTEND.md) | App structure, components, stores, routes |
| Backend | [BACKEND.md](BACKEND.md) | API structure, services, DB models |

## Key Directories

```
tpm/
  frontend/           # Expo/React Native app
    app/              # Expo Router file-based routing
    components/       # UI components
    store/            # Zustand state stores
    hooks/            # TanStack Query hooks
    services/         # API client adapters
    utils/            # Formatters, helpers
  backend/            # FastAPI app
    app/
      api/v1/         # REST endpoint modules
      models/         # SQLAlchemy ORM models
      services/       # Business logic layer
      schemas/        # Pydantic request/response validation
      database/       # DB connection, base models
      middleware/      # CORS, auth, logging, error handling
    alembic/          # DB migration scripts
  deploy/             # Deployment configs (Apache, Cloudflare)
```

## Business Domains

1. **Bengkel (Workshop)** -- Service queue, SPK, spare parts inventory, cashier
2. **Jual Beli Mobil (Car Trading)** -- Car inventory, investor JV, cost capitalization
3. **Jasa Angkut (Transportation)** -- Fleet management, manifest, trip tracking
4. **SDM (HRM & Payroll)** -- Employee DB, attendance, salary slips, advances
5. **Keuangan (Finance)** -- COA, cash/bank mutations, AR/AP, reports (P&L, Balance Sheet)

## Technical Stack

- **Frontend:** Expo 52, React Native 0.76, Expo Router 4, Zustand 5, TanStack Query 5, NativeWind 4, TailwindCSS 3
- **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2, Uvicorn
- **Database:** MySQL 8 / MariaDB 10.4+
- **Printing:** QZ Tray (web thermal printing), react-native-thermal-receipt-printer (mobile)
- **Notifications:** Expo Push Notifications, WebSocket real-time sync

## Hardware Integration

- **Thermal printers** via QZ Tray (desktop web) or native plugin (mobile)
- **Barcode scanners** via Expo Camera
- **Biometrics** via expo-local-authentication (fingerprint/face)

## Related Areas

- [Frontend Codemap](FRONTEND.md)
- [Backend Codemap](BACKEND.md)
- Root README at C:\laragon\www\tpm\README.md
