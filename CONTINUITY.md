# Continuity Ledger

## Goal
- Implement theme appearance settings in the profile page.
- Requirements:
    - Settings for primary, secondary colors, etc.
    - No hardcoded colors in the UI (use dynamic theme).
    - Use color picker (implemented via presets and hex input).

## Constraints/Assumptions
- Project uses NativeWind v4 (Tailwind for React Native).
- Persist theme settings using Zustand and AsyncStorage.
- Use CSS variables for dynamic colors.

## Key decisions
- Created `useUIStore` with `themeColors` persistence.
- Updated `tailwind.config.js` to use CSS variables: `--color-primary`, `--color-secondary`, etc.
- Updated `app/_layout.tsx` to inject dynamic theme variables using `vars` from `nativewind`.
- Created `app/settings/theme.tsx` as the theme customization screen.
- Updated `app/(tabs)/profile.tsx` to include "Tampilan" settings card and use dynamic theme colors.

## State
- Done: 
    - Updated `store/useUIStore.ts`.
    - Updated `tailwind.config.js` and `global.css`.
    - Updated `app/_layout.tsx` for dynamic injection.
    - Created `app/settings/theme.tsx`.
    - Updated `app/(tabs)/profile.tsx`.
    - Created `.vscode/settings.json` to silence "Unknown at rule @tailwind" IDE warnings.
- Now: Verifying implementation and ensuring no hardcoded colors remain in key UI elements.
- Next: Final check of the UI and inform the user.

## Open questions
- None.

## Working set
- `frontend/store/useUIStore.ts`
- `frontend/tailwind.config.js`
- `frontend/global.css`
- `frontend/app/_layout.tsx`
- `frontend/app/settings/theme.tsx`
- `frontend/app/(tabs)/profile.tsx`
