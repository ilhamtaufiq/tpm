---
tags: [tpm, session]
date: 2026-09-30
time: "12:00"
module: lainnya
status: done
agent: claude-code
files: [frontend/app/_layout.tsx, frontend/app/mobil/MobilHomeContent.tsx, "frontend/app/(tabs)/history.tsx", frontend/app/jasa-angkut/JasaAngkutHomeContent.tsx, frontend/components/ui/*Selector.tsx]
---

⬅️ [[CLAUDE|Kembali ke Hub]] · [[TPM - Log Pengembangan|Index Sesi]]

## Goal

Kurangi lag di aplikasi Android. Dari audit kode, penyebab utamanya beban di JS thread (Hermes): terlalu banyak render ulang dan list yang tidak di-virtualisasi.

## Constraints/Assumptions

- Hanya perubahan performa UI. **Tidak ada perubahan logika atau angka finance/laporan.**
- Tidak ada dependency baru.
- Belum diprofil di perangkat; verifikasi lewat `tsc --noEmit`. Bundle `expo export` gagal di environment cloud karena `react-native-worklets/plugin` tidak ada, dan ini tidak terkait perubahan ini.

## Keputusan

1. **Debounce search 350ms** (`useDebounce`) di Mobil, Jasa Angkut, armada, supir, customer, supplier, asset, serta Armada/Jasa/Mobil/Muatan/MasterData/SparePart selector. Nilai input tetap langsung; hanya query dan filter yang memakai nilai debounced.
2. **Carousel foto kartu mobil tanpa auto-slide.** Sebelumnya `setInterval` 3 detik per kartu. Sekarang list menampilkan foto pertama; foto lain tetap ada di detail.
3. **List mobil dan History pindah ke `FlatList`** (virtualized) dengan baris `React.memo` dan handler stabil. Sebelumnya `ScrollView` + `.map()`.
4. **Zustand pakai selector per field** (`useStore(s => s.x)`) di 54 tempat, termasuk root `_layout`. Tampilan finance/laporan hanya berubah cara subscribe ke `themeColors`/`user`; datanya sama.
5. **Root `_layout`**: `screenOptions` dan options `Stack.Screen` jadi konstanta modul, supaya tidak dibuat ulang tiap navigasi (`useSegments`).
6. **Build produksi**: `console.log/info/debug` di-noop. `warn/error` tetap aktif.

## Dampak Finance/Laporan

Tidak ada perubahan perilaku, sumber data, atau perhitungan. File finance/laporan yang tersentuh (piutang, hutang, tab finance, laporan) hanya berubah dari `const { x } = useStore()` ke selector. Invariant di [[TPM - Aturan Bisnis & Invariant]] tidak berubah.

## Status (Done / Now / Next)

- **Done**: poin 1–6, `tsc --noEmit` lolos.
- **Now**: uji di perangkat Android (Perf Monitor: bandingkan JS FPS vs UI FPS) dan pantau log "JS Thread Lag" di `/monitor`.
- **Next**:
  - List trip jasa angkut (`groupedTrips`) ke `SectionList`.
  - Resize foto sebelum upload dan pakai thumbnail di list (butuh `expo-image-manipulator` atau resize di backend).
  - Kurangi `useMobilList({status:'TERJUAL', limit: 500})` di Bengkel home/queue dan `limit: 5000` di master sparepart.

## Open Questions

- Perlu endpoint thumbnail di backend untuk foto mobil/sparepart?

## Working Set (file yang disentuh)

- `frontend/app/_layout.tsx`
- `frontend/app/mobil/MobilHomeContent.tsx`
- `frontend/app/(tabs)/history.tsx`
- `frontend/app/jasa-angkut/JasaAngkutHomeContent.tsx`, `armada/index.tsx`, `supir/index.tsx`
- `frontend/app/master-data/{customer,supplier,asset}.tsx`
- `frontend/components/ui/{Armada,Jasa,Mobil,Muatan,MasterData,SparePart}Selector.tsx`
- ±40 file lain: hanya konversi ke selector Zustand
