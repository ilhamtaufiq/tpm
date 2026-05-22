# Continuity Ledger - Customizable Bottom Navigation

## Goal
Implement a fully customizable 5-item bottom navigation bar for the TPM Super App with:
1. Dynamic slots configurable by the user via a settings screen.
2. A premium center Floating Action Button (FAB+) that triggers an elegant backdrop-blur quick-action modal overlay.
3. Persistent choice state saved locally via Zustand and AsyncStorage.

## Constraints/Assumptions
- Built on React Native, Expo 52, Expo Router 4, Zustand 5, and NativeWind 4.
- Icons dynamically loaded using `lucide-react-native` by looking up registered screens in `frontend/constants/NavigationRoutes.ts` (via `APP_ROUTES`).
- Maintain a premium design aesthetic (Stitch UI styling, rounded cards, linear gradients, spring micro-animations, Outfit font).

## Key Decisions
- Create `useNavigationStore.ts` inside `frontend/store/` to manage dynamic slot state (length 5, default: `['home', 'sdm-absensi', 'fab-plus', 'bengkel', 'profile']`).
- Override default React Navigation tab bar rendering in `(tabs)/_layout.tsx` using `tabBar={(props) => <CustomTabBar {...props} />}`.
- Dynamically handle both tab transitions (internal `/home`, `/profile`, etc.) and screen stack pushes (external `/bengkel`, `/sdm/absensi`, etc.) in the tab bar.
- Create a dedicated premium settings screen `frontend/app/settings/navigation.tsx` with a live interactive navigation preview.

## State
- **Done**: Created the Zustand store `useNavigationStore.ts`.
- **Done**: Completed research and analysis of the active layout configuration.
- **Done**: Formulated the full implementation plan and created the `implementation_plan.md` artifact.
- **Done**: Registered layout bindings in `(tabs)/_layout.tsx` and stack configurations in `settings/_layout.tsx`.
- **Done**: Implemented dynamic custom tab bar in `CustomTabBar.tsx` with floating action center button and action sheet overlay.
- **Done**: Implemented the bottom bar customization and live interactive preview screen in `settings/navigation.tsx` (fully resolving imports).
- **Done**: Added bottom navigation custom setting entry card in `profile.tsx` under a dedicated layout category.
- **Done**: Redesigned bottom navigation as a premium floating modern card and fixed FAB clipping.
- **Done**: Formulated and executed an architecture plan (`implementation_plan.md`) to migrate the bottom navigation to the Root Stack layout so it appears on all pages. Redesigned the FAB to be a standout, borderless floating icon.
- **Done**: Fixed pre-existing TypeScript error in `sparepart.tsx`.
- **Done**: Generated `app_design_documentation.md` mapping all app features.
- **Done**: Executed the architecture plan (`implementation_plan.md`) to completely redesign the Home screen based on the provided mockup (Header, Wallet Card, Service Grid, Recent Activity).
- **Done**: Updated bottom navigation design to match the user's latest HTML code snippet: restored the center FAB (Floating Action Button) with a white border (`border-4`), set default slots to Home, Bengkel, FAB, Logistik, and Mobil, and updated the active tab UI to use a square rounded box (`w-12 h-12 rounded-xl bg-primary/10`) wrapping both icon and text.
- **Done**: Redesigned the "Jual Beli Mobil" screen layout (Header search, Filter chips, Horizontal Cards), integrating the "Dompet" button correctly into the header and removing obsolete Bento grid items.
- **Now**: Awaiting review on the Mobil page layout redesign.
- **Next**: Implementasi master desain navigasi ke halaman Bengkel.

## Open Questions
- Awaiting feedback on the completed Mobil page redesign.

## Working Set
- `frontend/store/useNavigationStore.ts`
- `frontend/app/(tabs)/_layout.tsx`
- `frontend/components/ui/CustomTabBar.tsx`
- `frontend/app/settings/_layout.tsx`
- `frontend/app/settings/navigation.tsx`
- `frontend/app/(tabs)/profile.tsx`
- `CONTINUITY.md`
