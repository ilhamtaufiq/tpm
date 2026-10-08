---
tags: [tpm, modul, sdm, hrm, payroll]
---

# TPM — Modul SDM (HRM & Payroll)

⬅️ [[CLAUDE|Kembali ke Hub]]

## Fungsi Operasional

Database karyawan, rekam absensi harian terintegrasi, manajemen pengajuan kasbon karyawan, otomatisasi pembuatan slip gaji bulanan.

## Dampak Finansial

- Pencatatan liabilitas (gaji yang harus dibayar).
- Pemotongan otomatis saldo kasbon karyawan dari slip gaji.
- Pencatatan biaya overhead gaji.

## Alur Gaji (Akrual)

- Absensi HADIR (1 hari) / SETENGAH_HARI (0.5) bertanggal ≥ 12 Okt 2026 langsung jadi **beban gaji** dan **hutang gaji** (muncul di Neraca).
- Harian = gaji pokok / 6 × faktor. Slip mingguan memakai nilai absensi; jumlah hadir tidak bisa di-override.
- Slip yang dicairkan mengurangi hutang gaji; kasbon dipotong dari slip seperti biasa; lembur jadi beban saat dicairkan.
- Absensi yang sudah masuk slip tidak bisa diubah/dihapus sampai slip dihapus (hanya yang belum cair).

Detail: [[TPM - Aturan Bisnis & Invariant]] invariant 23. Kode: `backend/app/services/gaji_akrual_service.py`.

⬅️ [[CLAUDE|Kembali ke Hub]]
