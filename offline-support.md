# Offline Support & Synchronization Plan - TPM Super App

Dokumen ini merinci arsitektur dan langkah-langkah implementasi fitur akses offline serta sinkronisasi data otomatis dengan menggunakan **TanStack Query (React Query) v5** dan **AsyncStorage**.

## 1. Arsitektur & Teknologi

| Komponen | Library / Teknologi | Tujuan |
| :--- | :--- | :--- |
| **Persistence** | `@react-native-async-storage/async-storage` | Penyimpanan lokal untuk cache query dan state. |
| **Persister** | `@tanstack/query-async-storage-persister` | Menghubungkan cache React Query ke AsyncStorage secara otomatis. |
| **Network Listener** | `@react-native-community/netinfo` | Mendeteksi status koneksi internet (Online/Offline). |
| **Sync Manager** | TanStack Query `onlineManager` | Memberitahu React Query saat koneksi kembali untuk melakukan re-fetch atau retry. |

## 2. Strategi Implementasi

### A. Offline Reading (Read-Only)
Aplikasi akan menampilkan data terakhir yang berhasil di-fetch meskipun perangkat tidak terhubung ke internet.
- **Cache Persistence:** Menggunakan `persistQueryClient` dengan `AsyncStorage`.
- **Stale Time:** Mengatur `staleTime` yang lebih lama (misal: 10-30 menit) untuk mengurangi fetch berlebih saat online.
- **Cache Time (gcTime):** Menyimpan data di lokal (misal: 24 jam) agar tersedia saat aplikasi dibuka kembali dalam kondisi offline.

### B. Offline Writing (Mutations)
Penanganan aksi tambah/edit/hapus data saat offline.
- **Pause & Resume:** Mutasi akan di-pause otomatis saat offline (menggunakan `onlineManager`).
- **Auto-Retry:** Begitu internet kembali, React Query akan mencoba mengirim ulang mutasi yang tertunda.
- **Optimistic UI:** (Opsional/Bertahap) Menampilkan perubahan secara instan di UI seolah-olah berhasil, lalu melakukan rekonsiliasi setelah sinkronisasi server selesai.

### C. Monitoring Koneksi
- Integrasi `NetInfo` ke dalam `onlineManager`.
- Penambahan indikator visual di Header (e.g., "Mode Offline", "Menyingkronkan...").

## 3. Langkah Kerja (Action Items)

1. **Persiapan:**
   - Install dependencies: `npm install @react-native-community/netinfo @tanstack/query-async-storage-persister @tanstack/react-query-persist-client`.
2. **Konfigurasi `_layout.tsx`:**
   - Setup `createAsyncStoragePersister`.
   - Implementasi `persistQueryClient`.
   - Setup `onlineManager` listener.
3. **Pembaruan Service & Hooks:**
   - Memasukkan `networkMode: 'offlineFirst'` pada mutasi kritis.
4. **UI Enhancement:**
   - Buat komponen `ConnectivityBanner`.
   - Tampilkan status sinkronisasi pada dashboard.

## 4. Penanganan Konflik (Conflict Resolution)
Secara default, kita akan menggunakan pendekatan **"Last Write Wins"** atau membiarkan backend menolak jika data sudah berubah (409 Conflict), namun untuk MVP, kita akan fokus pada validasi status sukses saat online kembali.

---
**Status:** 🏗️ Planning
**Update Terakhir:** 2026-03-25
