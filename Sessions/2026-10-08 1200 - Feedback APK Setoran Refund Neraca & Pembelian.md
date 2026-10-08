---
tags: [tpm, session]
date: 2026-10-08
time: "12:00"
module: keuangan
status: partial
agent: claude-code
files: [backend/app/services/reports/modal_service.py, backend/tests/test_modal_setoran_dan_anchor.py, backend/app/services/penjualan_mobil_service.py, backend/app/api/v1/penjualan_mobil.py, backend/app/services/mobil_service.py, backend/tests/test_pembatalan_booking_refund.py, frontend/utils/queryClient.ts, frontend/components/MobilDetail.tsx, frontend/components/ui/SupplierFormModal.tsx, frontend/components/ui/MasterDataSelector.tsx, frontend/app/bengkel/purchase/create.tsx, frontend/app/bengkel/purchase/index.tsx, frontend/app/finance/piutang.tsx, frontend/app/finance/hutang.tsx, frontend/services/mobil.ts, frontend/hooks/useMobil.ts]
---

⬅️ [[CLAUDE|Kembali ke Hub]] · [[TPM - Log Pengembangan|Index Sesi]]

## Goal

Feedback APK 8 Okt: 7 poin (gaji, pembelian part, hutang/piutang pusat, pembatalan booking JB Mobil, setoran modal, lag pilih part, Neraca perlu refresh).

## Temuan

- **Setoran modal tak tampil di Penambahan Modal** (poin 5): setoran MODAL bertanggal *sebelum* saldo awal (anchor = impor IMP- paling awal) sudah ikut `modal_awal` beku (snapshot Neraca anchor), sehingga disembunyikan di Modal Awal dan `penyesuaian_backdate` = 0. Reproduksi: impor anchor 5 Okt + setoran 2 Okt → `setoran_modal` periode = 0.
- **Neraca perlu refresh** (poin 7): cache backend (`utils/cache.py`) sebenarnya stub (no-op). Penyebabnya klien: mutasi dari pembelian part, hutang, piutang, gaji, penjualan tidak mengirim event realtime ke scope finance, dan `neraca_report` punya `staleTime` 30 detik.
- **Lag pilih part** (poin 6): semua halaman katalog di-preload dan setiap kartu dirender ulang tiap toggle (`findIndex` per kartu).
- **Refund pembatalan booking** (poin 4): modal booking hanya punya jalur hutang (`UANG_MUKA_PENJUALAN`). `cancel_sale` (penjualan LUNAS) tidak punya UI.

## Keputusan

- Setoran pra-anchor dikeluarkan dari Modal Awal tampilan dan diakui sebagai setoran: yang jatuh di periode filter → Penambahan Modal, sisanya → Setoran Modal Bersih Sebelumnya. Total Modal Akhir tidak berubah. Setoran MODAL tidak lagi didaftar di `backdate_detail`.
- Refund booking: `refund_mode` `LANGSUNG` (kas KELUAR per metode/kas pilihan, total wajib = sisa DP) atau `HUTANG` (default, perilaku lama).
- Neraca: invalidasi `MutationCache` global untuk laporan keuangan setiap mutasi sukses.
- Pembelian part: urutan "Part dulu / Supplier dulu" dan tambah supplier baru inline (`SupplierFormModal`). Tombol (+) jadi FAB pojok kanan bawah di pembelian part, hutang, dan piutang.
- **Belum dikerjakan**: poin 1 (hutang gaji akrual dari absensi). Perlu keputusan: cutoff tanggal akrual, perlakuan slip dengan override jumlah hadir, dan pembulatan.

## Verifikasi

- `pytest tests` di MariaDB 10.11 (skema via `alembic upgrade head`): 76 passed, 11 skipped (baseline 72 passed, 11 skipped).
- Tes baru `test_setoran_sebelum_anchor_tampil_sebagai_penambahan_modal` gagal tanpa perbaikan (`0.0 == 5000000.0`).
- Tes baru `test_pembatalan_booking_refund.py` (3 tes) gagal tanpa perbaikan service.
- `tsc --noEmit` frontend bersih.

## Next

- Poin 1 (hutang gaji): tunggu keputusan user atas tiga pertanyaan di atas.
- Pembatalan penjualan LUNAS (`cancel-sale`) belum punya UI; jalur refund langsung/hutang yang sama bisa dipasang bila user mau.
