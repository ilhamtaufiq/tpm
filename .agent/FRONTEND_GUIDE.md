# Frontend Guide: TPM Super App

Panduan ini merangkum arsitektur frontend Expo/React Native yang dipakai saat ini.

## 1. Stack Utama
- Expo 52 / React Native 0.76
- Expo Router 4 (file-based routing)
- TanStack Query 5
- Zustand 5
- NativeWind 4
- AsyncStorage untuk persistence
- Axios untuk HTTP
- Expo Updates untuk OTA update

## 2. Struktur Routing
### Grup Sistem
- `(auth)`: login, OTP, forgot/reset password.
- `(tabs)`: home utama, finance ringkas, history, profile.
- `(security)`: layar PIN dan verifikasi akses.

### Modul Utama
- `bengkel/`
- `finance/`
- `jasa-angkut/`
- `laporan/`
- `master-data/`
- `mobil/`
- `sdm/`
- `settings/`
- `receipt/`

Routing utama dideklarasikan di `frontend/app/_layout.tsx` dan mengikuti struktur folder.

## 3. State Management
### TanStack Query
- `staleTime`: 10 detik.
- cache dipersist ke AsyncStorage dengan key `TPM_OFFLINE_CACHE`.
- `refetchOnWindowFocus` dan `refetchOnReconnect` aktif.
- cocok untuk data server dan sinkronisasi antar perangkat.

### Zustand Stores
- `useAuthStore`: user, token, status login.
- `useUIStore`: tema, nama app, logo, preferensi UI.
- `useSecurityStore`: PIN lock, biometrik, proteksi fitur, pembatasan web.
- `useMonitorStore`: state terkait monitor/dashboard.

## 4. Security Flow
- App dapat mengunci diri saat pindah ke background.
- Fitur tertentu dapat dilindungi PIN terpisah melalui `SEGMENT_TO_FEATURE` di `useSecurityStore.ts`.
- `disable_web_access` dapat mengarahkan user web ke landing khusus jika akses browser dibatasi.
- Status keamanan disinkronkan dari backend tetapi tetap dipersist lokal agar boot aplikasi tidak buta state.

## 5. Data Access Pattern
- Layar umumnya memanggil service domain di `frontend/services/`:
  - `bengkel.ts`
  - `mobil.ts`
  - `jasaAngkut.ts`
  - `keuangan.ts`
  - `sdm.ts`
  - `settings.ts`
- Hindari menaruh request API mentah langsung di komponen jika sudah ada service domain yang sesuai.

## 6. UI & Formatting
- NativeWind dipakai untuk utility styling.
- Tema dinamis dibaca dari `useUIStore`.
- Font utama menggunakan Outfit.
- Gunakan utilitas `frontend/utils/format.ts`, terutama `formatCurrency`, untuk konsistensi angka keuangan.
- Gunakan komponen feedback/alert yang konsisten pada validasi dan aksi penting.

## 7. Offline & Resilience
- Query cache dipersist 24 jam.
- Beberapa flow mendukung antrean/offline mode.
- Komponen konektivitas dan error boundary sudah ada di root layout; jangan menduplikasi pola penanganan global di tiap layar tanpa alasan.

## 8. Deployment & Update
- OTA update dicek saat aplikasi dibuka melalui `expo-updates`.
- Jika update tersedia, aplikasi fetch lalu reload otomatis.
- `app.json` mengatur `runtimeVersion`, `updates.url`, package id Android, plugin Expo, dan aset aplikasi.

## 9. Aturan Praktis Saat Mengubah Frontend
- Jika menambah modul route baru, pastikan:
  - folder route ada,
  - proteksi fitur diperbarui bila perlu,
  - navigasi dan menu ikut diperbarui.
- Jika mengubah payload finance, cek sinkron dengan schema backend dan layar laporan/finance terkait.
- Untuk nilai uang, jangan render angka mentah.
- Untuk perubahan security, cek sekaligus native flow dan web flow.
