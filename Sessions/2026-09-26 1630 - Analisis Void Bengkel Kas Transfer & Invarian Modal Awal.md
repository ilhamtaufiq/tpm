---
tags: [tpm, session]
date: 2026-09-26
time: "16:30"
module: keuangan
status: done
agent: claude-code
files: [backend/app/services/reports/modal_service.py, TPM - Log Pengembangan.md]
---

⬅️ [[CLAUDE|Kembali ke Hub]] · [[TPM - Log Pengembangan|Index Sesi]]

## Goal

Analisis selisih Kas/Bank Rp1.625.000 akibat void transaksi bengkel, pembersihan duplikasi row internal, dan penegasan invarian Modal Awal Beku (anti-geser anchor).

## Constraints/Assumptions

- Void transaksi bengkel merevers stok sparepart & membatalkan piutang/hutang internal.
- Transaksi Kas/Bank transfer riil (mis. Rp1.625.000) TIDAK boleh terhapus otomatis saat void transaksi bengkel agar tidak merusak audit trail kasir/bank riil.
- Modal Awal (posisi pembuka usaha) WAJIB tetap beku di Rp2.245.258.724,51 (v3) dan dilarang bergeser sesuai pergerakan tanggal anchor.

## Keputusan

1. **Kas/Bank Transfer vs Void Bengkel**:
   - Jika transaksi dibatalkan murni dan uang dikembalikan ke customer: Buat Kas Keluar (Refund) Rp1.625.000 di menu Kas & Bank.
   - Jika salah input (harusnya service unit JB Mobil): Edit nota bengkel → ubah kategori ke `Jual Beli Mobil` → hubungkan ke unit mobil terkait.
2. **Pembersihan Row Duplikat Internal**:
   - Menghapus duplikasi row `HutangUsaha` (ID 154) & `PiutangUsaha` (ID 302) bertanda `BATAL` dari nota BGL2609250004 agar tersisa row aktif tunggal (ID 155 & ID 304).
3. **Invarian Modal Awal Beku**:
   - Mengembalikan `FROZEN_MODAL_AWAL_V = 3` (`2.245.258.724,51`) di `modal_service.py` untuk menjamin Modal Awal tidak pernah bergeser oleh pergerakan anchor.

## Status (Done / Now / Next)

- **Done**: Penjelasan teknis void kas, pembersihan duplikat DB, penguncian modal awal beku v3, dan pencatatan sesi.
- **Now**: Commit dan push ke repository main.
- **Next**: Siap untuk sesi berikutnya.

## Open Questions

- None

## Working Set (file yang disentuh)

- `backend/app/services/reports/modal_service.py`
- `Sessions/2026-09-26 1630 - Analisis Void Bengkel Kas Transfer & Invarian Modal Awal.md`
- `TPM - Log Pengembangan.md`
