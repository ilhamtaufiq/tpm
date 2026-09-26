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

## Lokasi Kode

- Service laporan: `backend/app/services/reports/` (Laba Rugi, Neraca, Modal).
- Guardrail perubahan wajib verifikasi end-to-end — lihat [[TPM - Aturan Bisnis & Invariant#Guardrail Tambahan Khusus Finance/Laporan]].

> ⏳ Belum ada daftar Chart of Accounts default / struktur akun standar TPM di README — perlu digali dari `backend/app/models/` atau seed data.

⬅️ [[CLAUDE|Kembali ke Hub]]
