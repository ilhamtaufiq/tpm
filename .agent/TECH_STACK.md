# Technical Stack & Architecture

## Backend
- **Framework**: FastAPI (Python 3.10+)
- **ORM**: SQLAlchemy 2.0 (Mapped classes, async/sync session mix)
- **Database**: MySQL
- **Structure**:
  - `app/models/`: Database entities (keuangan, bengkel, mobil, jasa_angkut, karyawan, users).
  - `app/services/`: Core business logic (NeracaService, KasBankService, etc.).
  - `app/schemas/`: Pydantic V2 models for API contracts.
  - `app/api/`: REST endpoints.

## Frontend
- **Framework**: Expo / React Native (Universal App)
- **Styling**: NativeWind (Tailwind CSS for Native) / Custom UI Components
- **State Management**: React Query (TanStack Query) for API caching.
- **Routing**: Expo Router (File-based)

## Key Utilities
- `backend/app/utils/constants.py`: Source of Truth for Enums (Source, Types, Status).
- `frontend/utils/format.ts`: Currency and date formatting consistency.
