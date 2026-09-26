---
tags: [tpm, session, keuangan, neraca, perubahan-modal, kasbank, healing]
date: 2026-09-26
time: "19:30"
module: keuangan
status: done
agent: claude
files: [backend/heal_missing_kasbank.py, frontend/app/laporan/neraca.tsx]
---

⬅️ [[CLAUDE|Kembali ke Hub]] · [[TPM - Log Pengembangan|Index Sesi]]

## Goal

Menganalisis dan memperbaiki masalah transaksi uang masuk hilang (Rp 1.625.000 AKAS ALAM PB#64 & PB#47), membuka penguncian penseimbangan paksa (*forced balance*) pada laporan Neraca & Perubahan Modal, serta menyediakan script healing data otomatis untuk server production.

## Constraints/Assumptions

- `PembayaranPiutang` wajib tercatat ke entri `KasBank` MASUK dalam satu transaksi DB atomik.
- `KasBank.referensi_id` tidak boleh bentrok namespace antara ID `PembayaranPiutang` dan `PengeluaranBengkel`.
- Laporan Neraca UI (`neraca.tsx`) wajib menampilkan `cross_validation.selisih_equity` agar ketidakseimbangan riil tidak tertutup oleh mask visual `BALANCED`.
- Script healing (`heal_missing_kasbank.py`) harus aman dan *idempotent* (bisa dijalankan berulang kali tanpa duplikasi data).

## Keputusan

- Menyuntikkan entri `KasBank` MASUK yang hilang untuk `PembayaranPiutang` ID 64 (Rp 1.625.000 AKAS ALAM) & ID 47 (Rp 70.000 A Ajis) dan merebuild saldo `BANK_UTAMA` & `KAS_UTAMA`.
- Membuat script healing `backend/heal_missing_kasbank.py` untuk dijalankan di server production via `docker compose exec backend python heal_missing_kasbank.py`.
- Memperbaiki komponen `frontend/app/laporan/neraca.tsx` agar memvalidasi `cross_validation.selisih_equity` dan menampilkan badge warning `TERDAPAT SELISIH` jika terdapat ketidakseimbangan rekonsiliasi.

## Status (Done / Now / Next)

- **Done**:
  - Penambahan entri KasBank & rebuild saldo lokal berhasil.
  - Script `heal_missing_kasbank.py` dibuat dan teruji 100% idempotent.
  - `neraca.tsx` diupdate untuk menampilkan rekonsiliasi ekuitas riil.
- **Now**: commit & push ke repo.
- **Next**: Jalankan script `heal_missing_kasbank.py` di server production.

## Open Questions

- None.
