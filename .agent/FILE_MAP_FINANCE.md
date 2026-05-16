# Financial File Map (Peta File Keuangan)

Dokumen ini memetakan file yang benar-benar memegang tanggung jawab keuangan di sistem TPM saat ini.

## 1. Definisi Akun & Enum
- `backend/app/utils/constants.py`
  - `KasBankJenis`: akun kas/bank aktual (`KAS_UTAMA`, `BANK_UTAMA`, `KAS_UNIT_BENGKEL`, `KAS_UNIT_MOBIL`, `KAS_UNIT_JASA_ANGKUT`, serta akun bank spesifik).
  - `KasBankSource`: sumber/unit transaksi.
  - `KasBankType`: arah arus (`MASUK` / `KELUAR`).
  - Enum finance lain seperti `PiutangSource`, `HutangSource`, `PaymentMethod`, `PaymentStatus`.

## 2. Model Data
- `backend/app/models/keuangan.py`
  - `KasBank`
  - `PiutangUsaha`
  - `PembayaranPiutang`
  - `HutangUsaha`
  - `PembayaranHutang`
  - `Aset`

## 3. Ledger & Siklus Hutang/Piutang
- `backend/app/services/kas_bank_service.py`: operasi inti ledger kas/bank.
- `backend/app/services/kas_bank_integration.py`: helper pemetaan akun dan pembuatan entry kas/bank otomatis.
- `backend/app/services/piutang_service.py`: lifecycle piutang umum dan pembayaran.
- `backend/app/services/hutang_service.py`: lifecycle hutang umum dan pembayaran.
- `backend/app/services/kasbon_service.py`: pembuatan kasbon, piutang karyawan, pembayaran, dan potongan payroll.

## 4. Mesin Laporan
- `backend/app/services/reports/base.py`
  - Preprocessor data konsolidasi lintas unit.
  - Menyiapkan agregat, stok, biaya, gaji, dan `internal_elimination`.
- `backend/app/services/reports/laba_rugi_service.py`
  - Laporan laba rugi.
- `backend/app/services/reports/modal_service.py`
  - Perubahan modal, prive, investor sharing, dan rekonsiliasi profit.
- `backend/app/services/reports/neraca_service.py`
  - Neraca, bottom-up equity, modal non-kas, internal receivable/payable, dan `selisih`.

## 5. Internal Transactions & Kapitalisasi
- `backend/app/services/transaksi_bengkel_service.py`
  - Pusat pencatatan internal repair dari sisi bengkel.
  - Membuat `PiutangUsaha` internal dan `HutangUsaha` internal.
  - Menambahkan detail part/service ke mobil atau armada terkait.
- `backend/app/services/penjualan_mobil_service.py`
  - Menangani settlement internal saat mobil terjual/lunas.
  - Membatalkan atau membalikkan efek internal jika transaksi penjualan dibatalkan.
  - Memisahkan `HPP accounting` dari `real modal` untuk kebutuhan pembagian investor.
- `backend/app/services/mobil_service.py`
  - Mengelola biaya dan data stok mobil.
  - Mendukung kapitalisasi biaya, tetapi bukan satu-satunya pusat sinkronisasi internal.
- `backend/app/services/muatan_service.py`
  - Menangani biaya dan ringkasan operasional Jasa Angkut yang ikut masuk ke laporan keuangan.

## 6. Aturan Praktis Saat Debugging
- Salah saldo kas/bank: mulai dari `kas_bank_service.py` dan `kas_bank_integration.py`.
- Salah piutang/hutang: cek service domain sumber transaksi lebih dulu, lalu `piutang_service.py` / `hutang_service.py`.
- Laporan tidak sinkron: mulai dari `reports/base.py`, lalu cek `laba_rugi_service.py`, `modal_service.py`, dan `neraca_service.py`.
- Masalah repair internal mobil: cek berurutan `transaksi_bengkel_service.py` -> `penjualan_mobil_service.py` -> `reports/base.py` / `neraca_service.py`.
