---
tags: [tpm, modul, bengkel]
---

# TPM — Modul Bengkel (Workshop)

⬅️ [[CLAUDE|Kembali ke Hub]] · Lihat juga [[TPM - Aturan Bisnis & Invariant]]

## Fungsi Operasional

Pendaftaran antrian mekanik, Surat Perintah Kerja (SPK), pengelolaan stok sparepart otomatis, kasir/kasir kilat, cetak struk via thermal printer (lihat [[TPM - Arsitektur & Setup#Hardware — Thermal Printer (QZ Tray)]]).

## Dampak Finansial

- Pengurangan stok sparepart real-time.
- Pencatatan HPP (Harga Pokok Penjualan).
- Pengakuan piutang jika belum lunas.
- Komisi servis masuk ke slip gaji mekanik.

## Siklus Hidup Transaksi

```
[Pendaftaran Antrian] ──> [Pembuatan SPK & Estimasi] ──> [Pengerjaan Mekanik]
                                                                │
[Laporan Keuangan] <── [Jurnal Akuntansi] <── [Pembayaran] <────┘
```

1. **Antrian (Queueing)**: input registrasi kendaraan (pelat nomor, keluhan). Status: *Antre* / *Proses*. Tidak ada mutasi finansial Rp0 dicatat di tahap ini.
2. **Estimasi / SPK**: mekanik alokasikan sparepart (mengurangi stok virtual sementara) + tambah jasa servis.
3. **Penyelesaian Order & Pembayaran** — kasir menutup transaksi:
   - **Lunas**: kurangi stok fisik, catat Kas Masuk, catat HPP, akui Pendapatan Servis.
   - **Belum Lunas (Piutang)**: akui Piutang Usaha atas nama pelanggan, HPP tetap tercatat, status pengerjaan → *Selesai*.
   - Transaksi terbayar **tidak boleh dihapus** — wajib di-*void* via Reversal Ledger.

⬅️ [[CLAUDE|Kembali ke Hub]]
