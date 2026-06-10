# Agent Documentation Changelog

Catatan perubahan untuk dokumentasi di folder `.agent`.

## 2026-05-16

### Added
- `README.md` sebagai indeks utama dokumentasi `.agent`.
- `QUICK_START.md` sebagai panduan onboarding singkat.
- `CHANGELOG.md` untuk mencatat evolusi dokumentasi.

### Expanded
- `CONTEXT.md`
  - diperluas menjadi gambaran sistem, modul, konsep finansial, dan cara membaca proyek.
- `FINANCIAL_FLOW.md`
  - diperluas dengan alur procurement, revenue, internal service, payroll, wallet routing, dan dampak ke tiga laporan.
- `FRONTEND_GUIDE.md`
  - diperluas dengan stack aktual, struktur routing, state management, security flow, offline behavior, dan aturan perubahan frontend.
- `GUIDELINES.md`
  - diperluas menjadi aturan kerja lintas backend/frontend/reporting.
- `SYNC_LOGIC.md`
  - diperluas dengan retained earnings, bottom-up equity, modal non-kas, eliminasi internal, dan urutan debugging.
- `TECH_STACK.md`
  - diperluas dengan struktur backend/frontend, pola arsitektur, dan utility penting.
- `ACCOUNTING_RULES.md`
  - diperluas dengan routing akun, klasifikasi, dan checklist audit cepat.

### Corrected
- `DATABASE_SCHEMA.md`
  - nama tabel lama/generik diganti ke nama tabel aktual yang sesuai model backend.
- `FILE_MAP_FINANCE.md`
  - peta tanggung jawab file diperbarui agar memasukkan peran penting `penjualan_mobil_service.py`.
- `INTERNAL_TRANSACTIONS.md`
  - alur internal repair disesuaikan dengan implementasi aktual, termasuk settlement, reversal, dan pemisahan `HPP accounting` vs `real modal`.

### Notes
- Seluruh dokumen `.agent` diselaraskan dengan kode aktual per 16 Mei 2026.
- Jika ada perubahan besar pada finance, reporting, routing frontend, atau schema database, changelog ini sebaiknya ikut diperbarui.
