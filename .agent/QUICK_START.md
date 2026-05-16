# TPM Agent Quick Start

Panduan ini ditujukan untuk memahami proyek TPM dalam sekitar 5 menit sebelum mulai bekerja.

## 1. Apa Itu TPM?
TPM adalah sistem ERP multi-unit untuk:
- Bengkel,
- Jual Beli Mobil,
- Jasa Angkut,
- ditambah modul Keuangan dan SDM.

Satu sistem mencatat operasi per unit, tetapi laporan akhirnya tetap perlu terbaca secara konsolidasi untuk perusahaan.

## 2. Hal Paling Penting yang Harus Dipahami
### A. Unified Ledger
Semua arus uang nyata pada akhirnya harus masuk ke `kas_bank`.

### B. Tiga Unit, Satu Perusahaan
- Unit boleh punya laba masing-masing.
- Tetapi laba perusahaan tidak boleh menghitung transaksi internal dua kali.

### C. Internal Repair Mobil
Jika Bengkel memperbaiki mobil stok milik unit Mobil:
- Bengkel melihat pendapatan internal,
- Mobil menerima biaya yang dikapitalisasi,
- perusahaan menunda pengakuan laba konsolidasi sampai mobil benar-benar terjual.

### D. Neraca Tidak Dipaksa Seimbang
Equity dihitung bottom-up dari:
- modal kas,
- modal non-kas,
- laba ditahan,
- dikurangi prive.

Kalau ada `selisih`, itu sinyal investigasi, bukan angka yang harus ditutup paksa.

## 3. File yang Paling Sering Dibuka
### Backend finance/reporting
- `backend/app/utils/constants.py`
- `backend/app/models/keuangan.py`
- `backend/app/services/kas_bank_integration.py`
- `backend/app/services/reports/base.py`
- `backend/app/services/reports/neraca_service.py`
- `backend/app/services/transaksi_bengkel_service.py`
- `backend/app/services/penjualan_mobil_service.py`

### Frontend
- `frontend/app/_layout.tsx`
- `frontend/store/useAuthStore.ts`
- `frontend/store/useSecurityStore.ts`
- `frontend/store/useUIStore.ts`
- `frontend/services/`

## 4. Jika Mau Mulai Debugging
### Laporan salah
1. Cek parameter tanggal.
2. Buka `reports/base.py`.
3. Lanjut ke service laporan terkait.

### Neraca tidak seimbang
1. Cek `SYNC_LOGIC.md`.
2. Cek modal non-kas di `neraca_service.py`.
3. Cek internal receivable/payable dan saldo kas.

### Internal repair mobil aneh
1. Buka `INTERNAL_TRANSACTIONS.md`.
2. Cek `transaksi_bengkel_service.py`.
3. Cek `penjualan_mobil_service.py`.
4. Cek `internal_elimination` di report services.

## 5. Dokumen yang Wajib Dibaca Setelah Ini
1. `README.md`
2. `CONTEXT.md`
3. `FINANCIAL_FLOW.md`
4. `ACCOUNTING_RULES.md`
5. `GUIDELINES.md`

## 6. Jangan Lakukan Ini
- Jangan menambah adjustment hardcoded hanya agar laporan terlihat seimbang.
- Jangan memakai string literal jika enum resmi sudah ada.
- Jangan mengubah satu laporan tanpa memikirkan dua laporan lain.
- Jangan menganggap transaksi internal sama dengan transaksi eksternal biasa.
