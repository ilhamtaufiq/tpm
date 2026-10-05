---
tags: [tpm, session]
date: 2026-10-05
time: "20:00"
module: keuangan
status: done
agent: claude-code
files: [backend/app/utils/helpers.py, backend/app/schemas/tanggal.py, backend/app/schemas/keuangan.py, backend/app/schemas/bengkel.py, backend/app/schemas/jasa_angkut.py, backend/app/schemas/karyawan.py, backend/app/schemas/mobil.py, backend/app/services/kas_bank_service.py, backend/scripts/fix_tanggal_masa_depan.py, backend/tests/test_tanggal_transaksi_masa_depan.py, frontend/components/ui/DatePicker.tsx, frontend/components/PaymentModal.tsx, frontend/app/finance/mutasi.tsx, dashboard/src/hooks/useDashboard.ts, dashboard/src/pages/Kas.tsx]
---

⬅️ [[CLAUDE|Kembali ke Hub]] · [[TPM - Log Pengembangan|Index Sesi]]

## Goal

Feedback produksi 5 Okt: selisih neraca −460.200 vs real = kas/bank −455.500 + stok part −4.700. Telusuri dari backup `tpm_20261005_192256.sql`.

## Temuan

- Neraca sistem balance (selisih 0, `/validate` SYNCED) — selisih adalah sistem vs saldo real.
- **Stok −4.700** = revaluasi belum terealisasi: PAKING KNALPOT +500 (PBL2610050006), ORING PLUNGER −5.200 (PBL2610050009). Persediaan Neraca = harga perolehan; sesuai invariant, bukan bug.
- **Kas/bank**: 22 baris (kas_bank 12, pengeluaran 5, piutang 2, hutang 1, pembayaran hutang 2) diinput 5 Okt sejak 15:06 tetapi bertanggal **06-10** → tidak terhitung di Neraca 5 Okt (bersih −894.000; bank −2.505.500, kas +1.611.500). Server/pembelian tetap 05-10, jadi tanggal maju berasal dari perangkat/form, bukan backend.
- Sebelumnya (12:52) selisih persediaan 5.000 = nota BGL2610050001 memakai TUTUP RADIATOR KCL (45rb) padahal fisik BSR (50rb); dikoreksi user lewat edit nota.

- **Selisih kas/bank −455.500 terjelaskan penuh**: transaksi yang nyata terjadi 5 Okt tapi bertanggal 06-10 = piutang A Sandi 50.000 + token 203.000 + admin 2.500 + bus Sanggar 150.000 (= −405.500 saat lapor 15:43) + piutang Mang Las 50.000 (= −455.500). Belum terjadi di real: bayar hutang Shroud 240.000, makan sore 183.500, admin tarik tunai 15.000 (total 438.500). Koreksi selektif (`--kecuali kas_bank:30,35,36 pengeluaran_bengkel:16,17 pembayaran_hutang:2`) → kas+bank sistem 635.613.080,67 = real.

## Keputusan

- Backend: `TanggalTransaksi` (schema input) tolak tanggal > hari ini WIB (422); `KasBankService.create` tolak 400 (ikut transfer & adjust).
- Frontend/dashboard: semua default tanggal pakai `getTodayString()` (lokal), termasuk tombol "Hari Ini" `DatePicker` (commit 3da2019 masih UTC).
- Skrip `scripts/fix_tanggal_masa_depan.py` (dry-run default, `--apply`) set `tanggal = DATE(created_at)` + `rebuild_balances`. Diuji di backup 19:22: 22 baris, Neraca tetap balance, kas = Σ mutasi (kas 1.649.500, bank 633.525.080,67).

## Verifikasi

- `pytest tests` di backup produksi: 80 passed, 2 skipped (+16 tes baru).
- `tsc --noEmit` frontend & dashboard bersih.

## Next

- Jalankan skrip di produksi (dry-run dulu), lalu cek ulang selisih kas real per akun (BCA/BRI/kas).
