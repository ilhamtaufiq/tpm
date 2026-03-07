# Continuity Ledger - TPM Super App

## Goal
Fix incorrect behavior when wrong PIN is entered. It should show an error message instead of logging out the user.

## Status
- **Done**: 
    - Identified that 401 status code from backend causes global axios interceptor to logout the user.
    - Modified `backend\app\api\v1\security.py` to return `400 Bad Request` instead of `401 Unauthorized` for PIN verification failures.
    - Verified that frontend `pin.tsx` correctly catches 400 errors and displays the error message.
- **Now**: Completed the fix.
- **Next**: Final verification by the user.

## Key Decisions
- Changed PIN verification failure status code from 401 to 400. This is because 401 is globally handled as "Session Expired / Logout", while PIN is a secondary authentication layer. 400 is more appropriate as it indicates a validation error (wrong input) rather than an invalid session token.

## Working Set
- `backend/app/api/v1/security.py`
- `frontend/app/(security)/pin.tsx`
- `frontend/utils/api.ts`
