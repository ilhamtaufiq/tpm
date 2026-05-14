# Financial File Map (Peta File Keuangan)

Dokumen ini memetakan file mana yang bertanggung jawab atas logika keuangan dan akun di sistem TPM.

## 1. Definisi Akun & Parameter
- **`backend/app/utils/constants.py`**:
  - `KasBankJenis`: Definisi akun keuangan (`KAS_UTAMA`, `BANK_UTAMA`, `KAS_UNIT_BENGKEL`, dll).
  - `KasBankSource`: Definisi unit/sumber transaksi (`BENGKEL`, `MOBIL`, `JASA_ANGKUT`, `LAINNYA`).
  - `KasBankType`: Jenis arus (MASUK/KELUAR).

## 2. Model Data (Database Entities)
- **`backend/app/models/keuangan.py`**:
  - Tabel `KasBank`: Buku besar transaksi tunai/bank.
  - Tabel `Piutang`: Pencatatan piutang (Usaha, Karyawan, Internal).
  - Tabel `Hutang`: Pencatatan hutang (Supplier, Investor, Internal).
  - Tabel `Aset`: Daftar aset tetap perusahaan.

## 3. Logika Transaksi (Services)
- **`backend/app/services/kas_bank_service.py`**: Pusat logika manipulasi saldo kas/bank.
- **`backend/app/services/kas_bank_integration.py`**: Jembatan otomatis antara modul operasional (Bengkel/Mobil) dengan modul Keuangan.
- **`backend/app/services/piutang_service.py`** & **`hutang_service.py`**: Manajemen siklus hidup hutang/piutang.

## 4. Mesin Laporan (Reporting Engines)
- **`backend/app/services/reports/base.py`**: Pre-processor data keuangan. File ini mengumpulkan data dari semua unit untuk diolah.
- **`backend/app/services/reports/neraca_service.py`**: Logika spesifik Balance Sheet, termasuk "Modal Discovery".
- **`backend/app/services/reports/modal_service.py`**: Logika perubahan modal dan prive.

## 5. Sinkronisasi Unit (Internal Transactions)
- Logika sinkronisasi perbaikan mobil internal dikelola secara kolaboratif di:
  - `backend/app/services/transaksi_bengkel_service.py` (sisi Pendapatan Bengkel).
  - `backend/app/services/mobil_service.py` (sisi Penambahan Nilai Stok Mobil).
