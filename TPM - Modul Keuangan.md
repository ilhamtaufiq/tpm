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

## Aset Tetap (Penyusutan & Pelepasan)

- **Sumber aset**: `MANUAL` (input harga dan sumber dana pembelian) atau `MOBIL` (unit JB Mobil dari stok). Unit `MOBIL` dinilai sebesar nilai stok unit pada tanggal beli, tidak ada kas keluar, dan unit keluar dari stok (`mobil.tanggal_aset`) tanpa dicatat sebagai penjualan. Sumber `ARMADA` tidak lagi diterima untuk input baru; data lama tetap terbaca.
- **Penyusutan garis lurus**: (harga beli - nilai residu) / (umur ekonomis x 12) per bulan, dimulai dari bulan beli. Hanya diakui sampai hari ini dan berhenti pada tanggal jual.
- **Dampak laporan**: beban penyusutan masuk Laba Rugi sebagai beban umum. Neraca menampilkan aset tetap sebesar nilai buku (harga beli - akumulasi penyusutan). Perubahan Modal ikut mengurangi laba melalui beban operasional umum.
- **Pelepasan (jual)** via `POST /assets/{id}/jual`: status menjadi `DIJUAL`, dengan `tanggal_jual` dan `harga_jual`. Kas masuk sebesar harga jual (sumber `ASET`). Laba/rugi pelepasan = harga jual - nilai buku, dicatat di periode penjualan dan tampil di Laba Rugi sebagai "Laba/Rugi Pelepasan Aset".
- Unit mobil yang sudah dipindah ke aset tidak bisa dijual lewat menu penjualan mobil. Penjualan aset dilakukan lewat menu aset.

## Lokasi Kode

- Service laporan: `backend/app/services/reports/` (Laba Rugi, Neraca, Modal).
- Guardrail perubahan wajib verifikasi end-to-end — lihat [[TPM - Aturan Bisnis & Invariant#Guardrail Tambahan Khusus Finance/Laporan]].

> ⏳ Belum ada daftar Chart of Accounts default / struktur akun standar TPM di README — perlu digali dari `backend/app/models/` atau seed data.

⬅️ [[CLAUDE|Kembali ke Hub]]

## Rincian Per Nama (link pendek)

Tombol Kirim Rincian di Piutang Per Nama dan Hutang Per Nama membuat token rincian (`POST /per-nama/{piutang|hutang}/rincian-token`), lalu membagikan link pendek `/s/{kode}` yang meneruskan ke `/public/receipt/view/rincian_{piutang|hutang}/{token}`. Halaman hanya membaca data dan memuat semua struk non-BATAL dari nama itu. Aturan lengkap: invarian 40 di `TPM - Aturan Bisnis & Invariant.md`.
