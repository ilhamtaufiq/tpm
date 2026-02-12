# PANDUAN FRONTEND DEVELOPMENT DENGAN GEMINI AI
## Aplikasi Tiga Putra Motor (TPM) - "Super App" Style

---

## 📋 OVERVIEW

Panduan ini dirancang untuk membangun frontend aplikasi TPM dengan **Gaya Visual (UI/UX) seperti GoPay/GoJek**. Fokus pada tampilan yang modern, bersih, playful namun profesional, dan navigasi berbasis ikon (Super App).

**Design System "Gopay-ish":**
- **Dominant Color:** Green/Cyan palettes (Trust & Growth).
- **Layout:** Card-based, Rounded Corners (12px-16px), Clean Whitespace.
- **Navigation:** Bottom Bar + Grid Menu di Home.
- **Interactions:** Bottom Sheets untuk form/detail, Skeleton loading, Smooth animations.

**BS/Tech Stack:**
- **React Native 0.76+** (Latest architecture)
- **Expo SDK ~52**
- **NativeWind (Tailwind CSS)** -> *Crucial for rapid styling similar to modern web dev.*
- **React Navigation 6**
- **Zustand** (Simpler state management than Redux)
- **Lucide React Native** (Modern icons)
- **TanStack Query (React Query)** (For API caching & sync)

---

## 🚀 PHASE 1: FOUNDATION & THEME

### 1.1 Project Init & Tailwind Setup

**Prompt untuk Gemini:**

```text
Buatkan instruksi inisialisasi project React Native Expo terbaru dengan NativeWind (Tailwind CSS) v4.

Project Name: tpm-super-app
Structure:
/app
  /_layout.tsx
  /index.tsx
  /(tabs)
    /_layout.tsx
    /home.tsx
    /history.tsx
    /finance.tsx
    /profile.tsx
/components
  /ui
/constants
  Colors.ts
/store
  useAuthStore.ts

Tambahkan dependencies penting:
- nativewind
- tailwindcss
- lucide-react-native
- clsx
- tailwind-merge
- zustand
- @tanstack/react-query

Berikan konten file `tailwind.config.js` dengan custom colors ala "Fintech App":
- primary: '#023C69' (TPM Blue)
- secondary: '#EE2737'
- background: '#F9F9F9'
- surface: '#FFFFFF'
- text: '#1C1C1C'
- textGray: '#767676'
```

### 1.2 Design System Components (Atomic)

Aplikasi GoPay menggunakan komponen reusable yang konsisten. Minta Gemini buatkan komponen dasar ala Shadcn/UI versi Mobile.

**Prompt untuk Gemini:**

```text
Saya ingin membuat Design System component set untuk React Native menggunakan NativeWind.
Style harus mirip aplikasi GoPay: Rounded-lg, Bold shadows, Clean headers.

Buatkan kode untuk 5 komponen dasar ini di folder `/components/ui`:

1. **Card.tsx**
   - White background, rounded-2xl, subtle shadow, touchable (optional).
   - Props: variant ('elevated', 'outlined', 'flat').

2. **Button.tsx**
   - Variants: 'primary' (Green bg, white text), 'secondary' (Red bg), 'outline' (Green border, green text), 'ghost'.
   - Sizes: 'sm', 'md', 'lg'.
   - Full width support.
   - Loading spinner support.

3. **Input.tsx**
   - Rounded-lg, bg-gray-100, border-transparent focus:border-green-500.
   - Support "Label" dan "Error Message".
   - Support Left/Right Icon (e.g., untu Password eye).

4. **Badge.tsx**
   - Pill shape, text-xs font-semibold.
   - Variants: 'success' (bg-green-100 text-green-700), 'warning', 'error'.

5. **IconContainer.tsx**
   - Circle container untuk menu grid icons.
   - Props: bgColor, size.

Gunakan `clsx` dan `tailwind-merge` untuk handling classNames.
```

---

## 🏠 PHASE 2: "SUPER APP" HOME SCREEN

Ini adalah kunci tampilan GoPay. Header saldo, Grid Menu, dan Promo Banner.

### 2.1 Home Header & Wallet Section

**Prompt untuk Gemini:**

```text
Buatkan component `HomeHeader.tsx` yang mirip dengan GoPay Home.

Fitur:
1. **Top Bar:** Search bar "Cari layanan..." (full width rounded-full bg-white) + Icon User Profile.
2. **Wallet Card (Saldo Card):**
   - Container warna Biru Tua Gradient (mirip Gopay Blue) atau Hijau TPM.
   - Tampilkan "Saldo Kas" (Rp 150.000.000) dengan font bold besar.
   - Action Buttons kecil di dalam card: "Top Up" (Masuk), "Pay" (Keluar), "History".
   - Gunakan Lucide Icons: Wallet, ArrowUp, ArrowDown, History.

Styling dengan NativeWind. Pastikan terlihat "Premium" dan "Clean".
```

### 2.2 Grid Menu (Main Navigation)

**Prompt untuk Gemini:**

```text
Buatkan component `ServiceGrid.tsx` untuk menampilkan menu utama aplikasi TPM.
Layout: Grid 4 kolom.

Data Menu (Mapped to Backend Modules):
1. **Bengkel** (Icon: Wrench, Color: Orange) -> Module: Transaksi Bengkel & Spareparts
2. **Jual Mobil** (Icon: CarFront, Color: Blue) -> Module: Penjualan & Stock Mobil
3. **Jasa Angkut** (Icon: Truck, Color: Green) -> Module: Muatan & Supir
4. **Keuangan** (Icon: Banknote, Color: Purple) -> Module: Piutang & Kas Bank
5. **SDM/Payroll** (Icon: Users, Color: Teal) -> Module: Karyawan, Absensi & Gaji
6. **Laporan** (Icon: BarChart3, Color: Red) -> Module: Dashboard Summary & Profit
7. **Pengeluaran** (Icon: Receipt, Color: Amber) -> Module: Pengeluaran Operasional
8. **Master** (Icon: Database, Color: Gray) -> Module: Supplier & Customer

Setiap item menu terdiri dari:
- IconContainer (Circle bg-color-100)
- Icon (Lucide icon color-600)
- Label Text (text-xs text-center mt-1 text-gray-700 font-medium)

Pastikan grid responsive dan rapi.
```

### 2.3 Implementation di Home Screen

**Prompt untuk Gemini:**

```text
Gabungkan komponen-komponen sebelumnya ke dalam file `app/(tabs)/home.tsx`.

Struktur:
1. `SafeAreaView` bg-primary (untuk status bar matching).
2. `ScrollView` bg-gray-50.
3. `HomeHeader` di paling atas.
4. `WalletSection` (Sisa Kas & Bank).
5. `ServiceGrid` (Menu Utama) dengan Section Title "Layanan TPM".
6. `RecentTransactions` (List transaksi terakhir, simple version) di bawah grid.

Berikan kode lengkap `home.tsx`.
```

---

## 🛠 PHASE 3: FEATURE SCREENS (MODUL)

Setiap modul (Bengkel, Mobil, dll) akan memiliki "Sub-Home" sendiri atau flow transaksi.

### 3.1 Transaksi Bengkel Flow (Bottom Sheet Style)

Aplikasi modern jarang pindah full page untuk input simple. Gunakan Bottom Sheet.

**Prompt untuk Gemini:**

```text
Buatkan screen `BengkelScreen.tsx`.

Gunakan library `@gorhom/bottom-sheet` (jika user setuju) atau Modal biasa custom.

Layout:
1. List "Antrian Service Hari Ini" (Card style).
2. Floating Action Button (+) besar di kanan bawah.
3. Ketika FAB ditekan, munculkan **Bottom Sheet Form**:
   - Input: Plat Nomor (Auto capitalize)
   - Input: Keluhan
   - Select: Mekanik (Dropdown)
   - Button: "Masuk Antrian"

Berikan styling form yang clean, input besar, label jelas.
```

### 3.2 List Riwayat (Mirip Gojek History)

**Prompt untuk Gemini:**

```text
Buatkan component `TransactionItem.tsx` yang bisa dipakai untuk History Bengkel / Jual Beli / Angkut.

Layout:
- Left: Icon kategori (Bengkel/Mobil) dalam rounded box.
- Center: Title (ex: "Service Honda Jazz - B 1234 XX"), Subtitle (ex: "Ganti Oli + Tune Up"), Date (text-xs text-gray-400).
- Right: Amount (Rp 540.000) text-red-500 (pengeluaran) atau text-green-500 (pemasukan).
- Status Badge di pojok (LUNAS / PIUTANG).

Style harus flat, clean, dengan border-b tipis agar terlihat rapi dalam list.
```

---

## 💰 PHASE 4: FINANCE DASHBOARD

Halaman khusus "Keuangan" yang visualisasinya grafik dan kartu ringkasan.

### 4.1 Finance Overview

**Prompt untuk Gemini:**

```text
Buatkan screen `FinanceScreen.tsx`.

Components:
1. **Summary Cards (Horizontal Scroll):**
   - Card 1: Total Profit Bulan Ini
   - Card 2: Total Piutang
   - Card 3: Total Hutang
   
2. **Menu Quick Action:**
   - Catat Pengeluaran
   - Terima Bayaran
   - Transfer Kas

3. **Chart Placeholder:**
   - Area visual untuk grafik "Pemasukan vs Pengeluaran" (Gunakan library `react-native-gifted-charts` nanti).

Styling: Gunakan background putih bersih, shadow halus untuk cards agar data menonjol.
```

---

## 🔗 PHASE 5: DATA INTEGRATION (REACT QUERY)

### 5.1 Fetching Hook Pattern

**Prompt untuk Gemini:**

```text
Buatkan pattern custom hook menggunakan React Query untuk fetch data dari backend FastAPI.

File: `/hooks/useBengkel.ts`

1. `useGetAntrian()`: Fetch list antrian.
2. `useCreateService()`: Mutation untuk post data service baru.

Sertakan error handling dan loading state standar.
Gunakan Axios instance yang sudah secure (dengan Bearer token).
```

---

## 📝 TIPS PENGGUNAAN PROMPT

1. **Be Visual:** Selalu minta "Modern, Clean, Rounded, Shadow-sm" untuk menghindari tampilan kaku.
2. **Be Modular:** Minta kode per komponen kecil dulu, baru digabungkan.
3. **Tailwind First:** Selalu minta styling pakai Tailwind classes (NativeWind) agar mudah di-tweak. "Make the primary generic button green-600 with hover effect".
4. **Icons:** Spesifikasikan nama ikon dari Lucide/FontAwesome.

**Contoh Prompt One-Shot:**
> "Buatkan saya tampilan Detail Service Mobil. Header berisi Info Kendaraan (Plat, Merk) dengan background gradient hijau. Di bawahnya list sparepart yang diganti (Card style). Paling bawah ada Sticky Footer menampilkan Total Biaya dan tombol 'Bayar / Cetak Invoice'. Gunakan NativeWind, style mirip GoPay receipt."