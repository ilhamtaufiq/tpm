---
tags: [tpm, session]
date: 2026-09-30
time: "12:45"
module: mobil
status: done
agent: claude-code
files: [frontend/components/MobilCostForm.tsx, backend/app/services/mobil_service.py]
---

⬅️ [[CLAUDE|Kembali ke Hub]] · [[TPM - Log Pengembangan|Index Sesi]]

## Goal

Hentikan double count biaya admin & pajak di modul Mobil — footer "Total Tambahan Biaya" dan riwayat biaya menghitung baris yang sama dua kali.

## Constraints/Assumptions

- Ledger tetap `PengeluaranBengkel`; baris `MobilBiayaLainnya` tetap dipakai untuk HPP/modal unit.
- Tidak mengubah skema DB dan tidak ada dependency baru.
- Data lama yang sudah terlanjur dobel di DB **tidak** dibersihkan sesi ini.

## Temuan

`MobilService.add_biaya()` (`mobil_service.py:681` dan `:699`) menulis satu input biaya menjadi **dua baris paralel**:

1. `PengeluaranBengkel` — baris ledger, plus entri `KasBank` (`sumber=JUAL_BELI_MOBIL`)
2. `MobilBiayaLainnya` — baris HPP/modal unit

`MobilCostForm.tsx` lalu menjumlahkan keduanya:

- `calculateTotal()` (line 236–238) = `biaya_lainnya + pengeluaran_bengkel + part_services`
- Riwayat dirender dua section dari sumber yang sama: "RIWAYAT BIAYA ADMIN & PAJAK" (`biaya_lainnya`) dan "BIAYA OPERASIONAL BENGKEL (MIGRASI/PUSAT)" (`pengeluaran_bengkel`)

Akibatnya total di footer dan daftar riwayat menampilkan tiap biaya dua kali.

## Keputusan

1. **Satu sumber untuk UI** — `calculateTotal()` hanya memakai `biaya_lainnya + part_services`; blok render `pengeluaran_bengkel` dihapus. Ledger tetap terlihat lewat `biaya_lainnya`.
2. **Link eksplisit antar baris kembar** — `catatan` pada `MobilBiayaLainnya` jadi `f"ID Pengeluaran: {biaya.id}|{nomor_transaksi}"`, supaya baris ledger & KasBank bisa ditelusuri dari baris mobil.
3. **Delete bersih** — `delete_biaya()` sebelumnya hanya menghapus `MobilBiayaLainnya`, sehingga baris `PengeluaranBengkel` + `KasBank` tertinggal dan biaya "hidup lagi" di laporan. Sekarang: parse `nomor_transaksi` dari `catatan`, hapus `KasBank` & `PengeluaranBengkel` senomor, baru hapus baris mobil.
4. **Kompatibilitas data lama** — `catatan` tanpa pemisah `|` tidak match regex, sehingga hanya baris mobil yang dihapus (perilaku lama, aman — tidak menghapus ledger unit lain).

## Dampak Finance/Laporan

- Tidak ada perubahan skema, sumber angka, atau rumus laporan. `add_biaya` tetap menulis dua baris yang sama seperti sebelumnya.
- Yang berubah: `delete_biaya` kini juga membersihkan ledger + KasBank, sehingga P&L dan Neraca tidak lagi menyisakan biaya yang sudah dihapus user.
- Invariant di [[TPM - Aturan Bisnis & Invariant]] tidak berubah; double-entry tetap seimbang.

## Status (Done / Now / Next)

- **Done**: 4 poin keputusan, `tsc --noEmit` bersih, `ast.parse` `mobil_service.py` ok, regex `catatan` diverifikasi (`PKL2509300007` match, data lama tidak match).
- **Now**: verifikasi manual di UI — tambah biaya admin/pajak satu unit, cek footer "Total Tambahan Biaya" naik sekali saja.
- **Next**:
  - Script rekonsiliasi sekali-jalan untuk data lama yang sudah dobel (match `deskripsi` + `jumlah` + `tanggal` antara `PengeluaranBengkel` dan `MobilBiayaLainnya`).
  - Pertimbangkan satu baris saja sebagai sumber tunggal (drop `MobilBiayaLainnya` atau `PengeluaranBengkel`) untuk menghapus duplikasi struktural.
  - `delete_biaya` belum menghapus baris ledger saat data lama tanpa `|` — perlu backfill `catatan` kalau mau bersih penuh.

## Open Questions

- Perlukah biaya unit mobil masuk HPP sebagai baris terpisah, atau cukup ledger saja supaya struktur tidak pernah bisa dobel?

## Working Set (file yang disentuh)

- `backend/app/services/mobil_service.py` — `add_biaya` (catatan ber-link), `delete_biaya` (hapus ledger + KasBank), `import re`, `import KasBank`
- `frontend/components/MobilCostForm.tsx` — `calculateTotal()`, hapus blok render `pengeluaran_bengkel`
