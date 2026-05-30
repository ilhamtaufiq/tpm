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
- **Done**: Replaced the "TRX" badge in `WalletSection.tsx` with an interactive eye/eye-off icon to toggle visibility (hiding/unhiding) of the total balance nominal.
- **Done**: Added payroll period date range info (from/to dates) inside the `Payroll Detail` bottomsheet of the `Riwayat` tab in `slip-gaji.tsx`.
- **Done**: Integrated dynamic employee attendance dates query (fetching real attendance records) inside the `Payroll Detail` bottomsheet of `slip-gaji.tsx` under the Kehadiran list.
- **Done**: Added formatted booking date, payment method, and payment status info under the `Status Booking` card within the Mobil Detail bottomsheet of `MobilDetail.tsx`.
- **Done**: Added detailed sales transaction info (date sold, transaction number, payment method, payment status, buyer name) under the "Rincian Finansial" section when status is sold (`TERJUAL`) inside `MobilDetail.tsx`.
- **Done**: Enabled bottom navigation bar for BENGKEL role, customized menus to Dompet, Inventori, Master Data, and Absensi, and mapped the FAB+ button to trigger the Input Order Baru form directly on `/bengkel`.
- **Done**: Removed redundant Bento Grid menu (Dompet, Inventori, Master Data, Absensi) and conditionally hid the local FAB+ button from the main Bengkel page (`bengkel/index.tsx`) for BENGKEL role to prevent double button overlap and keep the visual interface premium and clean.
- **Done**: Resolved the `403 Forbidden` error for BENGKEL role by changing backend API authorization dependencies on the `/summary` (transaction summary metrics) and `/{id}/status` (updating vehicle status from queue to active work) endpoints to `UnitManagerUser` in `backend/app/api/v1/transaksi_bengkel.py`.
- **Done**: Resolved the Expo Router navigation deadlock and query param synchronization issues for the BENGKEL bottom tab bar menu. Built support for `router.setParams` when clicking the Dompet and FAB menu items from the active dashboard, added automatic parameter clearing on modal/sheet close, and added hybrid support for both Web (`showWalletModal`) and Mobile (`walletSheetRef`) triggers.
- **Done**: Added a premium Wallet button directly inside the Filter Search Overlay on the workshop dashboard (`bengkel/index.tsx`) next to the Filter/Scanner buttons, resolving access issues and bringing visual consistency across all unit screens.
- **Done**: Hid the QrCode scanner and Filter buttons from the dashboard Search Overlay entirely for all roles, allowing the Search bar to beautifully expand and keep the UI clean, spacious, and highly optimized.
- **Done**: Removed the "Info Hutang Internal Perbaikan Mobil" row from the Neraca report (`frontend/app/laporan/neraca.tsx`) per user request.
- **Done**: Added `Laba Investor` to the equity flow calculation and UI display in `perubahan-modal.tsx` to fix the balance discrepancy caused by missing investor profit.
- **Now**: The `Perubahan Ekuitas` report successfully balances and reconciles with the investor profit included.
- **Next**: Monitor and support further user requests or feature improvements.

## Open Questions
- None.

## Working Set
- `frontend/app/laporan/neraca.tsx`
- `frontend/app/laporan/perubahan-modal.tsx`
- `CONTINUITY.md`
