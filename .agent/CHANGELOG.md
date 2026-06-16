# Agent Documentation Changelog

Catatan perubahan untuk dokumentasi di folder `.agent`.

## 2026-06-12

### Fixed (Code & Docs)
- **Bug DP (Uang Muka) tidak masuk Hutang di Neraca**:
  - `reports/base.py`: Hapus filter `status_bayar != LUNAS` pada query `direct_bengkel_dp` dan `bengkel_dp`. Overpayment/DP tetap dihitung liabilitas meski transaksi berstatus LUNAS (terjadi saat `grand_total = 0`).
  - `modal_service.py`: Hapus `+ customer_dp` pada `kewajiban_usaha`. `hutang_usaha_total` sudah memuat DP — menambahkan lagi menyebabkan double-counting (modal aktual turun palsu).
  - `api/router.py`: Daftarkan `realtime.router` ke `api_router` agar WebSocket `/api/v1/realtime/ws` tidak 404.
- **UI Accessibility**: Bungkus `<Modal>` dengan `{show && <Modal>}` di `neraca.tsx` dan `perubahan-modal.tsx` untuk mencegah error `aria-hidden` pada elemen retain focus.

### Updated (Docs)
- `FINANCIAL_FLOW.md`: Tambah section 3.C (Down Payment Flow) dan row DP di tabel dampak laporan.
- `ACCOUNTING_RULES.md`: Tambah section 8 (DP / Uang Muka Penjualan).
- `SYNC_LOGIC.md`: Tambah section 10 (Down Payment) dengan pitfall double-counting dan filter LUNAS.
- `FINANCE_REPORTING_GUARDRAIL.md`: Tambah dua pitfall DP (double-counting kewajiban, filter LUNAS di query).

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
