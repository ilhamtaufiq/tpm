---
tags: [tpm, session]
date: 2026-09-26
time: "21:00"
module: keuangan
status: done
agent: claude-code
files: [dashboard/src/pages/Reports.tsx, dashboard/src/types/reports.ts, TPM - Log Pengembangan.md]
---

⬅️ [[CLAUDE|Kembali ke Hub]] · [[TPM - Log Pengembangan|Index Sesi]]

## Goal

Menyinkronkan laporan keuangan Modal (Perubahan Ekuitas), Neraca, dan Laba Rugi pada web `@dashboard` (`dashboard/src/pages/Reports.tsx` dan `dashboard/src/types/reports.ts`) dengan invarian keuangan terbaru backend dan frontend mobile Expo.

## Constraints/Assumptions

- Pengolahan laporan di web dashboard harus 100% konsisten dengan backend API dan frontend mobile Expo.
- Invarian `Aktiva = Pasiva` dan `Balance Check` pada Neraca & Perubahan Modal harus menampilkan selisih ekuitas/rekonsiliasi secara presisi tanpa ada field yang terlewati.

## Keputusan & Perubahan

1. **Tipe Laporan (`dashboard/src/types/reports.ts`)**:
   - Menambahkan field `laba_ditahan_pra_saldo_awal`, `penyesuaian_backdate_non_impor`, dan `laba_ditahan_sebelumnya` pada interface `CapitalReport`.
2. **Laporan Perubahan Modal (`Modal()` di `dashboard/src/pages/Reports.tsx`)**:
   - Mengisi ekstraksi `penyesuaianBackdateNonImpor` dan `labaDitahanSebelumnya`.
   - Mengklasifikasikan rincian ekuitas secara eksplisit ke dalam grup `Penambahan` (Setoran Modal, Laba Ditahan Pra-Saldo-Awal, Laba Ditahan Sebelumnya, Laba Operasional Periode) dan `Pengurangan` (Prive, Rugi Operasional, Rugi Ditahan Sebelumnya, Info Laba Investor).
   - Memperbarui perhitungan `perubahanBersih` dan `expectedAliran` sehingga 100% selaras dengan rumus teoritis backend.
3. **Laporan Neraca (`Neraca()` di `dashboard/src/pages/Reports.tsx`)**:
   - Menambahkan pengecekan `selisihEquity` (`cross_validation.selisih_equity`) pada penentuan status `isBalanced` dan penayangan selisih rekonsiliasi.
   - Menguraikan baris modal PASIVA menjadi `Setoran Modal`, `Laba Ditahan`, `Penyesuaian Harga Beli Spare Part (Memo)`, `Prive (Pengambilan Pemilik)`, dan `Total Modal`.
4. **Laporan Laba Rugi (`LabaRugi()` di `dashboard/src/pages/Reports.tsx`)**:
   - Menyempurnakan pemisahan komponen perbaikan bengkel dan biaya persiapan mobil (`soldRepair`/`unsoldRepair` & `soldPrep`/`unsoldPrep`) serta pesan info stok belum terjual.
5. **Verifikasi & Build**:
   - Menjalankan `npm run build` di `@dashboard` (`tsc -b && vite build`): PASSED 100% tanpa type error.
   - Menjalankan pengujian regresi backend pytest (`test_laporan_aliran_modal_vs_laba_rugi.py`, `test_kas_jenis_guard.py`): 10/10 PASSED.

## Working Set (file yang disentuh)

- `dashboard/src/pages/Reports.tsx`
- `dashboard/src/types/reports.ts`
- `Sessions/2026-09-26 2100 - Sinkronisasi Laporan Keuangan Dashboard Web dengan Invarian Ekuitas.md`
- `TPM - Log Pengembangan.md`
