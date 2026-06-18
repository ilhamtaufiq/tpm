# Frontend Codemap

**Last Updated:** 2026-06-17
**Entry Points:** `frontend/app/_layout.tsx`, `frontend/app/index.tsx`, `frontend/app/(tabs)/_layout.tsx`

## Project Structure

```
frontend/
  app/                      # Expo Router (file-based routing)
    _layout.tsx             # Root layout: QueryClient, Auth guard, Security (PIN), TabBar, fonts
    index.tsx               # Root redirect
    landing.tsx             # Web access restricted landing
    monitor.tsx             # System performance monitor
    +not-found.tsx          # 404 catch-all
    (auth)/                 # Unauthenticated routes
      _layout.tsx, login.tsx, forgot-password.tsx, otp.tsx, reset-password.tsx
    (security)/             # PIN/biometric security
      _layout.tsx, pin.tsx
    (tabs)/                 # Main bottom tab navigator
      _layout.tsx, home.tsx, history.tsx, finance.tsx, profile.tsx
    bengkel/                # Workshop module
      _layout.tsx, index.tsx, order.tsx, queue.tsx, expenses.tsx, inventory.tsx
      purchase/index.tsx, purchase/create.tsx, purchase/_layout.tsx
      transaksi/index.tsx
    mobil/                  # Car trading module
      _layout.tsx, index.tsx
    jasa-angkut/            # Transportation module
      _layout.tsx, index.tsx
      armada/index.tsx, armada/form.tsx, armada/detail/[id].tsx, armada/_layout.tsx
      muatan/form.tsx
      supir/index.tsx, supir/form.tsx, supir/_layout.tsx
    sdm/                    # HR module
      _layout.tsx, index.tsx, karyawan.tsx, absensi.tsx, kasbon.tsx, slip-gaji.tsx
    finance/                # Finance module
      _layout.tsx, akun.tsx, hutang.tsx, laporan.tsx, mutasi.tsx
      pencairan-investor.tsx, piutang.tsx, user-cash.tsx
      expenses/index.tsx, expenses/_layout.tsx
    laporan/                # Reports module
      _layout.tsx, index.tsx, laba-rugi.tsx, neraca.tsx, perubahan-modal.tsx
      penjualan-bengkel.tsx, penjualan-mobil.tsx, pembelian-sparepart.tsx
      pembelian-mobil.tsx, jasa-angkut.tsx, stock-sparepart.tsx
    master-data/            # Master data module
      _layout.tsx, index.tsx, customer.tsx, supplier.tsx, sparepart.tsx
      jasa-servis.tsx, asset.tsx
    settings/               # Settings module
      _layout.tsx, profile.tsx, password.tsx, theme.tsx, users.tsx
      backup.tsx, bluetooth.tsx, branding.tsx, navigation.tsx, notifications.tsx
      print.tsx, scanner.tsx, security-features.tsx, smtp.tsx, trash.tsx
    receipt/                # Receipt viewing
      _layout.tsx, [type]/_layout.tsx, [type]/[id].tsx
  components/               # Reusable UI components
    ui/                     # Design system / UI kit (see below)
    jasa-angkut/            # Transportation-specific components
    *.tsx                   # Feature-specific components (PaymentModal, BengkelForm, etc.)
  store/                    # Zustand state stores
  hooks/                    # TanStack Query hooks
  services/                 # Axios API service adapters
  utils/                    # Helpers (format, api, error, print, qzTray, receiptTemplates)
  context/                  # AlertContext provider
  constants/                # NavigationRoutes app index
  types/                    # TypeScript type definitions (qz-tray, reports)
```

## Architecture

```
[_layout.tsx Root]
  |-- ConnectivityBanner
  |-- ErrorBoundary
  |-- BottomSheetModalProvider
  |-- Stack (Expo Router)
  |     |-- (auth)/login, forgot-password, otp, reset-password
  |     |-- (security)/pin
  |     |-- (tabs)/home, history, finance, profile
  |     |-- bengkel/*, mobil/*, jasa-angkut/*, sdm/*
  |     |-- finance/*, laporan/*, master-data/*, settings/*
  |     |-- receipt/[type]/[id]
  |     |-- landing, monitor, +not-found
  |-- CustomTabBar (global, shown for ADMIN/BENGKEL roles)
  |-- [Web: Mobile preview frame when window > 640px]
```

## Key Components

### Header (`components/ui/Header.tsx`)
Global header for all screens. Two variants:
- **home** -- Brief TPM branding, no back button, no profile
- **page** (default) -- Title/subtitle, optional back button, profile icon, search icon

Features:
- Full-screen **search modal** -- filters `APP_ROUTES` by label/description/category, role-based filtering
- **User menu dropdown** -- Profile settings, logout with confirmation dialog
- **Impersonation mode** -- Banner + stop button when admin acts as another user
- Notification bell with unread badge (from `useNotificationStore`)
- Role-aware RBAC on search results, logout clears push token
- Profile picture with fallback to User icon

### CustomTabBar (`components/ui/CustomTabBar.tsx`)
Global bottom navigation bar with 5 configurable slots + animated radial FAB menu.
- **Active slots** configurable via `useNavigationStore` (default: home, bengkel, fab-plus, angkut, mobil)
- BENGKEL role overrides slots: Home, Inventori, FAB+, Master Data, Absensi
- **FAB+** button opens centering radial menu with 3 sub-FABs (configurable via `fabSlots` / `pageFabSlots`)
- Page-specific FAB overrides for bengkel, mobil, and angkut sub-pages
- Animated with `Animated.spring` for radial menu opening/closing
- Slot state persisted via AsyncStorage (useNavigationStore)
- Height: 80px + safe area bottom inset

### AppBottomSheet (`components/ui/AppBottomSheet.tsx`)
Wrapper around `@gorhom/bottom-sheet` for native platforms, falls back to `Modal` on Web.
- `snapPoints`, `onClose`, `scrollable`, `paddingHorizontal`
- Web: modal with max-width 640px, slide animation
- Native: `BottomSheetBackdrop`, `enablePanDownToClose`, `BottomSheetScrollView`
- Ref exposes `open()` and `close()` via `useImperativeHandle`
- Handles Android hardware back + Web browser back via `navigation.addListener('beforeRemove', ...)`
- Forwarded ref pattern for parent control

### PaymentModal (`components/PaymentModal.tsx`)
Payment processing for piutang (AR) and hutang (AP).
- **Split payment** support -- multiple methods per transaction
- Allowed methods: TUNAI, TRANSFER, QRIS, GIRO, KARTU_KREDIT, etc.
- Fetches real-time `kas_bank` balances to show available funds
- Unit-aware: maps unit (BENGKEL/JASA_ANGKUT/JUAL_BELI_MOBIL) to appropriate cash accounts
- Uses `useProcessPaymentSplit` / `useProcessHutangPaymentSplit` mutations (TanStack Query)
- Error handling via `getErrorMessage`
- Initial amount formatted via `formatNumber`, parsed back via `parseNumber`

### Other Feature Components

| Component | File | Purpose |
|-----------|------|---------|
| BengkelForm | `components/BengkelForm.tsx` | Workshop transaction form (SPK, parts, services) |
| BengkelPaymentModal | `components/BengkelPaymentModal.tsx` | Workshop-specific payment |
| BusinessPulse | `components/BusinessPulse.tsx` | Home dashboard KPIs |
| ConnectivityBanner | `components/ConnectivityBanner.tsx` | Online/offline indicator |
| HomeHeader | `components/HomeHeader.tsx` | Home screen header |
| MobilDetail | `components/MobilDetail.tsx` | Car detail view |
| MobilForm | `components/MobilForm.tsx` | Car entry form |
| MobilCostForm | `components/MobilCostForm.tsx` | Car cost/capitalization form |
| MobilSalesForm | `components/MobilSalesForm.tsx` | Car sales form |
| ServiceGrid | `components/ServiceGrid.tsx` | Service selection grid |
| WalletSection | `components/WalletSection.tsx` | Cash balance display |
| TransactionList | `components/TransactionList.tsx` | Transaction history list |
| TransactionDetailModal | `components/TransactionDetailModal.tsx` | Transaction detail |
| StatsSlider | `components/StatsSlider.tsx` | Dashboard stats carousel |
| RelatedBengkelTransactions | `components/RelatedBengkelTransactions.tsx` | Related workshop txns |

### UI Component Library (`components/ui/`)

| Component | File | Description |
|-----------|------|-------------|
| Header | `Header.tsx` | Global screen header (search, user menu, back) |
| CustomTabBar | `CustomTabBar.tsx` | Configurable bottom nav with radial FAB |
| AppBottomSheet | `AppBottomSheet.tsx` | Cross-platform bottom sheet (native + web modal) |
| Button | `Button.tsx` | Primary/secondary/outline buttons |
| Input | `Input.tsx` | Text input with label, error, icon |
| Card | `Card.tsx` | Surface card container |
| Typography | `Typography.tsx` | Text component with variants (h1-h3, body1, caption) |
| Badge | `Badge.tsx` | Status/count badge |
| Tabs | `Tabs.tsx` | Horizontal tab selector |
| Skeleton | `Skeleton.tsx` | Loading placeholder |
| EmptyState | `EmptyState.tsx` | Empty data state illustration |
| AlertDialog | `AlertDialog.tsx` | Confirmation/alert dialog |
| BaseModal | `BaseModal.tsx` | Reusable modal wrapper |
| FinancialRow | `FinancialRow.tsx` | Financial data row display |
| Barcode | `Barcode.tsx` | Barcode display (react-native-qrcode-svg) |
| BarcodeScannerModal | `BarcodeScannerModal.tsx` | Camera-based barcode scanner |
| JasaSelector | `JasaSelector.tsx` | Service/jasa selector |
| SparePartSelector | `SparePartSelector.tsx` | Spare part picker with stock |
| KaryawanSelector | `KaryawanSelector.tsx` | Employee selector |
| MobilSelector | `MobilSelector.tsx` | Car selector |
| MuatanSelector | `MuatanSelector.tsx` | Cargo manifest selector |
| ArmadaSelector | `ArmadaSelector.tsx` | Fleet vehicle selector |
| CustomerFormModal | `CustomerFormModal.tsx` | Quick customer creation |
| MasterDataSelector | `MasterDataSelector.tsx` | Generic master data picker |
| ReceiptPreview | `ReceiptPreview.tsx` | Receipt print preview |
| ReceiptQRCode | `ReceiptQRCode.tsx` | QR code for receipt |
| ThermalReceipt | `ThermalReceipt.tsx` | Thermal printer receipt layout |

## Store Architecture (Zustand)

### useAuthStore (`store/useAuthStore.ts`)
Persisted via `expo-secure-store`. Manages user session.
- **State:** user, token, isAuthenticated, hasHydrated, isImpersonating, impersonatorUser, originalUser, originalToken
- **Actions:** setAuth, updateUser, startImpersonation, stopImpersonation, logout
- Impersonation saves original user/token; `stopImpersonation` restores them
- Hydration complete flag ensures layout waits for stored auth

### useNavigationStore (`store/useNavigationStore.ts`)
Persisted via AsyncStorage. Configurable navigation layout.
- **State:** activeSlots (5 slots), fabSlots (3 radial FAB slots), pageFabSlots (per-page overrides)
- **Actions:** updateSlot, updateFabSlot, updatePageFabSlot, resetSlots
- Default slots: ['home','bengkel','fab-plus','angkut','mobil']
- Default FAB: ['bengkel','fin-mutasi','mobil']
- Page-specific FABs for bengkel, angkut, mobil sub-pages

### useUIStore (`store/useUIStore.ts`)
Persisted via AsyncStorage. Theme and branding.
- **State:** isDarkMode, isLoading, themeColors (primary, secondary, background, surface, text, textGray), appLogo, appName
- **Actions:** toggleDarkMode, setLoading, setThemeColor, resetTheme, setBranding
- Default primary: `#023C69`, secondary: `#EE2737`
- Theme colors exposed as CSS custom properties via `vars()` in root layout

### useSecurityStore (`store/useSecurityStore.ts`)
Persisted via AsyncStorage. PIN/biometric access control.
- **State:** isLocked, unlockedFeatures, isPinEnabled, protectedFeatures, useBiometrics
- **Actions:** syncWithBackend, enableBiometrics, lock, unlock, unlockFeature
- **Feature-level protection** per route segment (finance, bengkel, jasa_angkut, laporan, etc.)
- Biometrics via `expo-local-authentication`
- On rehydrate: auto-lock if PIN enabled

### useMonitorStore (`store/useMonitorStore.ts`)
In-memory (not persisted). API request monitoring.
- **State:** requestCount, errorCount, avgLatency, totalPayloadSize, logs[], serverStats
- **Actions:** logRequest, updateResponse, setServerStats, clearLogs
- Logs capped at 100 entries, tracks duration/payload size per request

### useNotificationStore (`store/useNotificationStore.ts`)
Persisted via AsyncStorage. Real-time push notifications.
- **State:** items (RealtimeNotification[]), unreadCount
- **Actions:** pushNotification, markAsRead, markAllRead, removeNotification, clear
- Deduplication by sourceId, capped at 20 items
- Storage quota recovery: clears all on quota exceeded error

## Route Structure (Expo Router File-based)

```
/                           -> redirect (index.tsx)
/landing                    -> Web access restricted notice
/login                      -> (auth) login form
/forgot-password            -> (auth) forgot password
/otp                        -> (auth) OTP verification
/reset-password             -> (auth) password reset
/pin                        -> (security) PIN verify/create
/home                       -> (tabs) Dashboard
/history                    -> (tabs) Transaction history
/finance                    -> (tabs) Finance hub
/profile                    -> (tabs) User profile
/bengkel                    -> Workshop hub
/bengkel/order              -> Workshop order/SPK form
/bengkel/queue              -> Today's queue
/bengkel/expenses           -> Workshop expenses
/bengkel/inventory          -> Spare part inventory
/bengkel/purchase           -> Purchase list
/bengkel/purchase/create    -> Purchase order form
/bengkel/transaksi          -> Workshop transactions
/mobil                      -> Car trading hub
/jasa-angkut                -> Transportation hub
/jasa-angkut/armada         -> Fleet list
/jasa-angkut/armada/form    -> Fleet form
/jasa-angkut/armada/detail/:id -> Fleet detail
/jasa-angkut/muatan/form    -> Manifest form
/jasa-angkut/supir          -> Driver list
/jasa-angkut/supir/form     -> Driver form
/sdm                        -> HR hub
/sdm/karyawan               -> Employee list
/sdm/absensi                -> Attendance
/sdm/kasbon                 -> Employee advances
/sdm/slip-gaji              -> Salary slips
/finance/akun               -> Chart of accounts
/finance/hutang             -> Accounts payable
/finance/piutang            -> Accounts receivable
/finance/mutasi             -> Cash/bank mutations
/finance/laporan            -> Financial reports
/finance/user-cash          -> Cashier session management
/finance/pencairan-investor -> Investor disbursement
/finance/expenses           -> Expense management
/laporan                    -> Reports hub
/laporan/laba-rugi          -> P&L statement
/laporan/neraca             -> Balance sheet
/laporan/perubahan-modal    -> Equity change statement
/laporan/penjualan-bengkel  -> Workshop sales report
/laporan/penjualan-mobil    -> Car sales report
/laporan/pembelian-sparepart -> Parts purchase report
/laporan/pembelian-mobil    -> Car purchase report
/laporan/jasa-angkut        -> Transportation report
/laporan/stock-sparepart    -> Stock report
/master-data                -> Master data hub
/master-data/customer       -> Customer management
/master-data/supplier       -> Supplier management
/master-data/sparepart      -> Spare part master
/master-data/jasa-servis    -> Service master
/master-data/asset          -> Fixed asset list
/settings                   -> Settings hub
/settings/profile           -> User profile edit
/settings/password          -> Password change
/settings/theme             -> Theme customization
/settings/users             -> User management (admin)
/settings/navigation        -> Tab bar customization
/settings/backup            -> Database backup
/settings/bluetooth         -> Bluetooth printer pairing
/settings/print             -> Printer settings
/settings/scanner           -> Scanner config
/settings/branding          -> App branding (logo, name)
/settings/notifications     -> Notification settings
/settings/security-features -> Feature-level PIN protection
/settings/smtp              -> Email config
/settings/trash             -> Soft-deleted records
/monitor                    -> System performance monitor
/receipt/:type/:id          -> Receipt view (public)
```

## External Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| expo | Framework | ~52.0.0 |
| expo-router | File-based routing | ~4.0.0 |
| react-native | Core | 0.76.9 |
| zustand | State management | ^5.0.10 |
| @tanstack/react-query | Async state / caching | ^5.90.20 |
| nativewind | TailwindCSS for RN | ^4.2.1 |
| @gorhom/bottom-sheet | Bottom sheet component | ^5 |
| axios | HTTP client | ^1.13.4 |
| lucide-react-native | Icons | ^0.563.0 |
| react-native-safe-area-context | Safe area | 4.12.0 |
| expo-secure-store | Secure token storage | ~14.0.1 |
| qz-tray | Thermal printing (web) | ^2.2.6 |
| react-native-thermal-receipt-printer | Thermal printing (native) | ^1.2.0 |
| expo-camera | Barcode scanning | ~16.0.18 |
| expo-local-authentication | Biometrics | ~15.0.2 |
| expo-notifications | Push notifications | ^56.0.15 |
| @tanstack/react-query-persist-client | Offline cache | ^5.95.2 |
| date-fns | Date formatting | ^4.1.0 |
| clsx | Class merging | ^2.1.1 |
| tailwind-merge | Tailwind class merge | ^3.4.0 |

## Data Flow

```
User Action
  -> Component (e.g. BengkelForm)
    -> TanStack Query Mutation (e.g. useCreateTransaksiBengkel)
      -> Service layer (Axios POST /api/v1/...)
        -> API response
          -> queryClient.invalidateQueries (cache refresh)
            -> UI re-render
```

Real-time sync via WebSocket (`services/realtime.ts`) pushes notifications
  -> `useNotificationStore.pushNotification` updates badge count.

## Related Areas

- [Backend Codemap](BACKEND.md)
- [Root INDEX](INDEX.md)
