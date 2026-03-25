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
    - Analyzed avatar upload and profile update logic.
    - Verified backend implementation of `/auth/me/avatar` and `/auth/me` PUT.
- Now: Investigating why `profile_picture` is not persisting or is being overwritten in the store.
- Next: 
    - Modify `handleSave` in `profile.tsx` to be more robust (merge results & fetch latest).
    - Add logging to verify what backend returns.

## Open Questions (UNCONFIRMED)
- Why does the PUT `/auth/me` call potentially return stale data or clear the `profile_picture`?
- Is there a race condition between the successive POST and PUT calls?

## Working Set
- `backend/app/api/v1/auth.py`
- `backend/app/services/auth_service.py`
- `frontend/services/auth.ts`
- `frontend/app/settings/profile.tsx`
- `frontend/utils/image.ts`

