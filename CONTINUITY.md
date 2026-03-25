# CONTINUITY Ledger - TPM Project

## Goal
Implement offline access and data synchronization for the application.
- Success Criteria:
  - Users can view and perform actions while offline.
  - Data synchronizes automatically when net connection is restored.
  - Conflicts are minimized or handled.

## Constraints/Assumptions
- Frontend uses React Native (Expo) with Zustand and TanStack Query (React Query) v5.
- Persistence is likely handled by AsyncStorage or similar.
- Backend API is mature enough to handle timestamped/versioned updates if needed.

## Key Decisions
- Leverage TanStack Query's persistent cache (`persistQueryClient`) for offline reading.
- Implement an "Offline Queue" or use TanStack Query's `onMutation` / `onSuccess` for synchronization.
- Use `NetInfo` to detect network status.

## State
- Done: Identified tech stack (React Query v5, Zustand, AsyncStorage, Axios).
- Done: Created `offline-support.md` with a detailed implementation plan.
- Now: Awaiting user confirmation to begin implementation (installing dependencies).
- Next: Install `@react-native-community/netinfo` and configure `persistQueryClient`.

## Open Questions
- Is the user seeing any error messages? (Assuming no since they didn't mention it, but that might mean silent failure).
- Does the profile picture change ONLY after a manual app restart/refresh? (If so, it's definitely a store/state/cache issue).

## Working Set
- `frontend/services/auth.ts`
- `frontend/app/settings/profile.tsx`
- `backend/app/api/v1/auth.py`
- `backend/app/services/auth_service.py`
