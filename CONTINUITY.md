# Continuity Ledger - TPM Super App

## Goal
Implement "Batasi Akses Web" (Restrict Web Access) feature that can be toggled from the mobile app settings or via frontend environment variables. Also brand update from "Tulus Putra Mandiri" to "Tiga Putra Motor". Fix EAS Update configuration issues. Solve Android AlertDialog rendering/visibility issues.

## Constraints/Assumptions
- Web access restriction redirects users to `/landing?reason=mobile_only`.
- Local setting `is_pin_enabled` is required for granular PIN protection, but platform-level access (like web restriction) should be configurable independently of PIN status.
- Frontend ENV `EXPO_PUBLIC_DISABLE_WEB_ACCESS` acts as a hard override (locks the feature to enabled).
- EAS Updates require a channel to be specified in `eas.json` when `update.url` is present in `app.json`.
- Android Native View layer has race conditions between Keyboard/BottomSheet dismissal and Modal entrance.

## Key Decisions
- Refactored `AlertDialog.tsx` to include a full-screen overlay for better centering and visibility on Android.
- Added 400ms delay to `AlertDialog` across major modules (`Mutasi`, `Piutang`, `Kasbon`, `Jasa Angkut`, `Bengkel`, `Mobil`) when triggered after closing a `BottomSheet` or `Modal`.
- [Previous decisions...]

## State
- Done:
  - [x] Implementation of redirection logic in `app/_layout.tsx` and `app/index.tsx`.
  - [x] UI Toggle in `app/settings/security-features.tsx` under new "Akses Platform" section.
  - [x] Brand identity update in `landing.tsx` (Logo & Name).
  - [x] Fix invalid EAS Update configuration in `eas.json`.
  - [x] **Refactored AlertDialog.tsx to fix Android rendering issues.**
  - [x] **Applied 400ms delay to AlertDialog across all business unit screens.**
  - [x] **Optimized Android keyboard handling by using `adjustResize` in `app.json`.**
  - [x] **Updated `KeyboardAvoidingView` behavior and `BottomSheet` keyboard props across the app.**
- Now:
  - Feature complete and UI stability fixes (keyboard, modal race conditions) applied.
- Next:
  - Final verification on a physical Android device.
  - Deploy via `eas update`.

## Open Questions (UNCONFIRMED)
- None.

## Working Set
- `frontend/components/ui/AlertDialog.tsx`
- `frontend/app/finance/mutasi.tsx`
- `frontend/app/finance/piutang.tsx`
- `frontend/app/sdm/kasbon.tsx`
- `frontend/app/jasa-angkut/index.tsx`
- `frontend/app/bengkel/index.tsx`
- `frontend/app/mobil/index.tsx`
- `frontend/app/landing.tsx`
- `frontend/eas.json`
