---
tags: [tpm, modul, keuangan, finance]
---

# TPM — Modul Keuangan (Finance)

⬅️ [[CLAUDE|Kembali ke Hub]] · **Baca dulu**: [[TPM - Aturan Bisnis & Invariant]] — modul ini paling sensitif terhadap invariant finansial + guardrail khusus.

## Fungsi Operasional

Pembuatan bagan akun (Chart of Accounts), pencatatan mutasi kas & bank, rekonsiliasi kas kasir (User Cash), pelacakan hutang-piutang jatuh tempo.

## Dampak Finansial

- Pembuatan Neraca Saldo (Balance Sheet).
- Laporan Laba Rugi (Profit & Loss).
- Laporan Perubahan Modal.
- Penegakan aturan double-entry balancing.

## Pembatalan Transaksi (Batalkan)

Berlaku untuk Catat Biaya Operasional, Pemberian Kasbon/Piutang, kasbon karyawan (SDM), Terima Dana (Pusat), dan Setoran ke Akun Utama. Tidak ada hapus fisik: transaksi dibatalkan dengan alasan wajib, jurnalnya dibalik, dan tercatat di **Riwayat Pembatalan** (`/finance/pembatalan`, tautan di halaman Mutasi Kas).

- Dari Mutasi Kas dan riwayat dompet unit (Bengkel, Jasa Angkut, Mobil): tombol **Batalkan** pada tiap baris. Baris pengeluaran membatalkan lewat `/pembatalan/pengeluaran/{id}`, baris kas lewat `/pembatalan/kas/{id}`, yang juga mencari dokumen asalnya (piutang, kasbon, atau pasangan transfer).
- Dampak laporan: transaksi batal tidak lagi dihitung di Neraca, Laba Rugi, Perubahan Modal, dan dashboard. Jurnal asli dan jurnal balik disembunyikan lewat filter ORM (`backend/app/models/pembatalan_filter.py`).
- Ditolak bila: alasan kurang dari 5 karakter; dokumen sebelum saldo awal; piutang sudah ada pembayaran atau piutang dari transaksi unit; saldo akun tujuan transfer jadi negatif.
- Detail aturan: invariant 35 di [[TPM - Aturan Bisnis & Invariant]].

## Lokasi Kode

- Service laporan: `backend/app/services/reports/` (Laba Rugi, Neraca, Modal).
- Guardrail perubahan wajib verifikasi end-to-end — lihat [[TPM - Aturan Bisnis & Invariant#Guardrail Tambahan Khusus Finance/Laporan]].

> ⏳ Belum ada daftar Chart of Accounts default / struktur akun standar TPM di README — perlu digali dari `backend/app/models/` atau seed data.

⬅️ [[CLAUDE|Kembali ke Hub]]
