# 📋 Task List: TPM Frontend Development (Super App Style)

Fasilitas pelacakan progres pembangunan frontend Tiga Putra Motor menggunakan **React Native**, **Expo**, dan **NativeWind v4**.

---

## 🟢 PHASE 1: FOUNDATION & ATOMIC DESIGN
*Setup dasar dan komponen UI reusable.*

- [x] **1.1 Prsoject Initialization**
  - [x] Initialize Expo project with Router
  - [x] Install dependencies (NativeWind, Lucide, Zustand, etc.)
  - [x] Configure `tailwind.config.js` with TPM color palette
  - [x] Integrated Google Sans Aesthetic (Outfit Font)
  - [x] Fixed Web Support (react-native-web)
- [x] **1.2 Atomic UI Components (folder: `/components/ui`)**
  - [x] `Card.tsx` (Glassmorphism & Shadows)
  - [x] `Button.tsx` (Variants: Primary, Secondary, Ghost)
  - [x] `Input.tsx` (Clean style with labels)
  - [x] `Badge.tsx` (Status indicators)
  - [x] `Typography.tsx` (Heading & Body presets)
- [x] **1.3 Infrastructure**
  - [x] Setup Axios instance with interceptors
  - [x] Setup Zustand store for Auth & Theme

---

## 🟡 PHASE 2: NAVIGATION & AUTH SHELL
*Struktur navigasi utama dan sistem login.*

- [x] **2.1 App Layouts**
  - [x] Root `_layout.tsx` with Providers
  - [x] `(tabs)` layout with custom Bottom Bar
  - [x] `(auth)` group for Login/Register
- [/] **2.2 Authentication Flow**
  - [x] Login screen (Premium look)
  - [ ] Persistent storage for JWT tokens

---

## 🔵 PHASE 3: HOME SCREEN (THE SUPER APP FACE)
*Halaman utama dengan gaya visual GoPay.*

- [x] **3.1 Home Header**
  - [x] Search bar & Profile trigger
  - [x] Wallet Card (Saldo Kas & Bank)
- [x] **3.2 Service Grid (8 Backend Modules)**
  - [x] Implement grid menu:
    1. Bengkel (POS)
    2. Jual Mobil
    3. Jasa Angkut
    4. Keuangan
    5. SDM/Payroll
    6. Laporan/Dashboard
    7. Pengeluaran
    8. Master Data
- [x] **3.3 Recent Activity**
  - [x] Transaction list preview component

---

## 🔴 PHASE 4: FEATURE MODULES IMPLEMENTATION
*Detail fungsionalitas untuk setiap modul bisnis.*

- [x] **4.1 Bengkel Module** ✅
  - [x] Antrian service list (Service Queue)
  - [x] POS Form (Order Creation: Jasa & Parts)
  - [x] Inventory List & Stok Minimum alerts
  - [x] Pembelian Spareparts (Purchase from Supplier)
  - [x] Pengeluaran Operasional Bengkel
- [x] **4.2 Jual Mobil Module**
  - [x] Car Inventory (Detail Unit: Photos, Rangka, Mesin)
  - [x] Biaya Unit (BBN, Perbaikan per Unit)
  - [x] Sales POS (Profit Split Investor logic)
- [x] **4.3 Jasa Angkut Module**
  - [x] Supir management (Active/Inactive status)
  - [x] Muatan Log (Rute, BBM, Tol, Laba 50/50)
- [x] **4.4 Keuangan & Laporan Module**
  - [x] Profit summary cards
  - [x] Kas & Bank Dashboard (Journal/Mutasi)
  - [x] Piutang Usaha (Status filter: Belum Lunas, Cicilan, Lunas)
- [x] **4.5 SDM & Payroll Module**
  - [x] Employee Directory
  - [x] Absensi (Clock-in/out via App)
  - [x] Kasbon Karyawan
  - [x] Slip Gaji (Preview & Status bayar)
- [ ] **4.6 Master Data**
  - [ ] Customer & Supplier management

---

## 🔐 PHASE 5: API INTEGRATION & POLISHING
*Koneksi data dan penyempurnaan UX.*

- [ ] **5.1 Data Sync**
  - [ ] Implement TanStack Query hooks for all modules
  - [ ] Error boundary & Empty state handling
- [ ] **5.2 Polishing (The "WOW" Factor)**
  - [ ] Skeleton loading states
  - [ ] Micro-animations with `moti` or `framer-motion-react-native`
  - [ ] Final UI/UX Audit
