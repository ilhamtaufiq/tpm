# Project Context: TPM (Transport, Penjualan, & Maintenance)

## 1. Ringkasan Sistem
TPM adalah sistem ERP/operasional terpadu untuk ekosistem bisnis multi-unit. Sistem ini menggabungkan pencatatan operasional harian, keuangan, SDM, laporan manajemen, dan kontrol akses dalam satu aplikasi.

Tujuan utamanya:
- mencatat transaksi tiap unit secara terpisah,
- tetap menjaga laporan konsolidasi perusahaan,
- menghubungkan kegiatan operasional dengan ledger keuangan,
- menghindari laba ganda saat ada transaksi antar-unit.

## 2. Unit Bisnis Utama
1. **Bengkel**
   - servis kendaraan,
   - penjualan spare part,
   - pembelian part,
   - pengeluaran operasional,
   - pekerjaan internal untuk Mobil dan Jasa Angkut.
2. **Jual Beli Mobil**
   - stok mobil,
   - pembelian dan persiapan unit,
   - biaya tambahan,
   - penjualan cash/kredit,
   - skema investor dan pencairan investor.
3. **Jasa Angkut**
   - armada dan supir,
   - ritase/muatan,
   - biaya perjalanan,
   - pembagian laba TPM vs supir,
   - biaya armada terkait perawatan.

## 3. Modul Pendukung
- **Keuangan**: kas/bank, piutang, hutang, aset, mutasi, laporan.
- **SDM**: karyawan, absensi, slip gaji, kasbon.
- **Master Data**: customer, supplier, jasa servis, aset, spare part.
- **Security & Settings**: PIN lock, proteksi fitur, konfigurasi aplikasi.
- **Monitoring & Backup**: endpoint monitor backend, backup, trash/restore.

## 4. Konsep Finansial Inti
Sistem memakai **unified ledger**:
- transaksi punya sumber/unit (`BENGKEL`, `JUAL_BELI_MOBIL`, `JASA_ANGKUT`, dll),
- tetapi dana dapat berada di akun pusat (`KAS_UTAMA`, `BANK_UTAMA`) atau wallet unit,
- sehingga laporan unit dan laporan konsolidasi bisa dibaca dari basis data yang sama.

## 5. Logika Khas Sistem
### Internal Transactions
Pekerjaan Bengkel untuk mobil stok atau armada sendiri bukan transaksi eksternal biasa. Sistem mencatatnya sebagai transaksi internal agar:
- laba unit Bengkel tetap terlihat,
- biaya unit tujuan tetap tercermin,
- laba konsolidasi tidak terlalu tinggi sebelum aset benar-benar terjual.

### Modal Discovery
Sistem menghitung modal secara bottom-up. Jika ada aset/stok yang tercatat tetapi tidak ditemukan pembelian kas atau hutang yang sesuai, nilainya dapat masuk ke **Modal Non-Kas**.

### Bottom-Up Equity
Neraca tidak dipaksa seimbang dengan rumus `Equity = Assets - Liabilities`. Equity dibentuk dari komponen riil:
1. modal kas,
2. modal non-kas,
3. laba ditahan,
4. dikurangi prive.

## 6. Sumber Kebenaran Saat Debugging
- Konsep bisnis: dokumen `.agent`.
- Implementasi model/tabel: `backend/app/models/`.
- Alur transaksi: `backend/app/services/`.
- Perhitungan laporan: `backend/app/services/reports/`.
- Kontrak API: `backend/app/schemas/` dan `backend/app/api/v1/`.
- Alur UI mobile/web: `frontend/app/`, `frontend/services/`, `frontend/store/`.

## 7. Prinsip Membaca Sistem
- Bedakan **unit profit** dari **profit konsolidasi**.
- Bedakan **arus kas** dari **pengakuan pendapatan/beban**.
- Jangan menganggap satu transaksi hanya berdampak pada satu modul; banyak alur mengubah ledger, piutang/hutang, stok, dan laporan sekaligus.
