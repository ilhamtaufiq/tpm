# Continuity Ledger - TPM Super App

## Goal
Redesign the `all-menus.tsx` screen and simplify the Home navigation to a minimalist Bento layout.

## Constraints/Assumptions
- Framework: React Native / Expo.
- Styling: NativeWind (Tailwind CSS for React Native).
- Design: Premium Bento Layout, Stitch UI.

## Key Decisions
- **All Menus Redesign:** Implemented dark header, floating search, and bento tiles with real-time balance section.
- **Home Navigation:** Removed floating navigation and bottom tab bar globally as requested.
- **Home UI:** Expanded `ServiceGrid` to 8 items (color-coded) to replace the missing tab bar navigation.

## State
- **Done**: Redesigned `all-menus.tsx`, added balance section, removed floating navigation, removed whole bottom tab bar.
- **Now**: Verifying the accessibility of all modules from the Home menu.
- **Next**: Final polish on layout transitions.

## Open Questions
- Is the 8-item grid enough, or should we show even more shortcuts?

## Working Set
- `frontend/app/all-menus.tsx`
- `frontend/app/(tabs)/_layout.tsx`
- `frontend/components/ServiceGrid.tsx`
