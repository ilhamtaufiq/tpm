# Frontend Guide: TPM Super App

Dokumen ini menjelaskan arsitektur dan pola pengembangan aplikasi mobile TPM (Expo/React Native).

## 1. Routing & Navigation (Expo Router)
Aplikasi menggunakan **File-based Routing**.
- **`(auth)`**: Folder untuk login dan pendaftaran.
- **`(tabs)`**: Menu utama di bar navigasi bawah.
- **`(security)`**: Layar PIN dan proteksi keamanan.
- **Modul Utama**: Folder seperti `bengkel`, `mobil`, `finance`, `sdm`, dan `jasa-angkut` berisi layar operasional masing-masing unit.

## 2. State Management & Data Fetching
- **TanStack Query (React Query)**:
  - **Stale Time**: 10 detik (Data dianggap usang setelah 10 detik untuk menjaga sinkronisasi real-time).
  - **Offline Persistence**: Menggunakan `AsyncStorage` untuk menyimpan data agar aplikasi tetap bisa dibuka tanpa internet.
  - **Re-fetch**: Otomatis re-fetch saat aplikasi kembali ke foreground atau internet tersambung kembali.
- **Zustand**: Digunakan untuk state global yang simpel:
  - `useAuthStore`: Token dan data user.
  - `useUIStore`: Tema warna dan setting UI.
  - `useSecurityStore`: Status PIN dan fitur yang terkunci.

## 3. Keamanan (Security System)
- **PIN Lock**: Aplikasi akan mengunci otomatis jika pindah ke background (bisa diatur di Settings).
- **Feature Protection**: Admin bisa mengunci folder/modul tertentu dengan PIN tambahan. Pemetaan folder ke fitur ada di `useSecurityStore.ts`.
- **Web Access**: Ada opsi untuk membatasi akses melalui browser.

## 4. Styling & UI
- **NativeWind**: Tailwind CSS untuk React Native.
- **Dynamic Theme**: Warna primer/sekunder bisa diubah dari `useUIStore`.
- **Typography**: Menggunakan font **Outfit** dari Google Fonts.

## 5. Deployment & Update
- **Expo Updates (OTA)**: Aplikasi secara otomatis mengecek update terbaru setiap kali dibuka. Jika ada versi baru, aplikasi akan mendownload dan restart sendiri.
- **EAS Build**: Digunakan untuk membuat file `.apk` atau `.ipa`.
