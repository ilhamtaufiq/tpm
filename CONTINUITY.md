# Continuity Ledger

## Goal
Implement user avatar update functionality and integrate it with the backend.

## Constraints/Assumptions
- Backend: FastAPI.
- Frontend: Expo (React Native).
- Storage: Local storage in `uploads/` directory.
- Timezone: WIB (Asia/Jakarta).

## Key Decisions
- Added `/auth/me/avatar` endpoint for multipart file upload.
- Used `expo-image-picker` on the frontend for selecting images.
- Created `getFileUrl` utility in frontend to handle server-side image paths.
- Serves static files from the `uploads/` directory on the backend.

## State
- Done:
    - Implemented `/auth/me/avatar` and `/auth/me/home-background` endpoints.
    - Updated User model and schemas with `home_background`.
    - Added background management to `ThemeSettingsScreen`.
    - Linked `ProfileScreen` to `ThemeSettingsScreen`.
    - Updated `Header` and `HomeHeader` to display custom background.
- Now: Feature implementation complete.
- Next: User verification.

## Open Questions (UNCONFIRMED)
- None.

## Working Set
- `backend/app/api/v1/auth.py`
- `backend/app/services/auth_service.py`
- `frontend/services/auth.ts`
- `frontend/app/settings/profile.tsx`
- `frontend/utils/image.ts`

