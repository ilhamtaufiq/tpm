# CONTINUITY Ledger - TPM Project

## Goal
Fix profile picture upload functionality which is currently reportedly not updating the UI after upload.

## Constraints/Assumptions
- Backend handles image upload and returns updated user object with permanent URI.
- Frontend uses Zustland for global auth state.
- Expo ImagePicker provides local file URIs (e.g., `file://`).
- Backend generates unique filenames using UUIDs.
- Axios/FormData handling in React Native requires specific headers or none depending on the boundary.

## Key Decisions
- Refactor `authService.uploadAvatar` to let Axios handle the `Content-Type` boundary for native platforms.
- Improve `ProfileSettingsScreen.tsx` merge logic to prioritize the newly uploaded profile picture over stale data from subsequent API calls.
- Add a cache-buster (timestamp) to the profile picture URL on the frontend to force image re-renders if necessary (though unique filename should help, some browsers/apps cache base paths or specific URI patterns).

## State
- Done: Identified that the global Axios instance has a default `Content-Type: application/json` header that was interfering with multipart uploads, leading to 422 errors. Explicitly overrode it in the service layer.
- Now: Fixed the 422 Unprocessable Entity error.
- Next: Final user verification.

## Open Questions
- Is the user seeing any error messages? (Assuming no since they didn't mention it, but that might mean silent failure).
- Does the profile picture change ONLY after a manual app restart/refresh? (If so, it's definitely a store/state/cache issue).

## Working Set
- `frontend/services/auth.ts`
- `frontend/app/settings/profile.tsx`
- `backend/app/api/v1/auth.py`
- `backend/app/services/auth_service.py`
