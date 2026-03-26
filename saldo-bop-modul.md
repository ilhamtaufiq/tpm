# Perencanaan Fitur Saldo BOP (Biaya Operasional) Modul

Dokumen ini merinci rencana implementasi fitur saldo khusus untuk biaya operasional pada modul **Jasa Angkut** dan **Bengkel / Showroom Mobil** tanpa mengubah arus kas keseluruhan.

## 1. Konsep Dasar

Fitur ini akan menggunakan sistem `KasBank` yang sudah ada namun dengan kategori akun (`KasBankJenis`) yang dikhususkan untuk dana operasional modul tertentu, dipisahkan berdasarkan bentuk fisiknya (Detailed Option).

*   **Saldo BOP Jasa Angkut**: 
    - `BOP_JASA_ANGKUT_CASH`: Dana tunai dipegang supir/lapangan.
    - `BOP_JASA_ANGKUT_BCA`: Dana di rekening operasional muatan.
*   **Saldo BOP Mobil / Showroom**: 
    - `BOP_MOBIL_CASH`: Dana tunai untuk perbaikan minor/salon di showroom.
    - `BOP_MOBIL_BCA`: Dana di rekening khusus perbaikan/operasional showroom.
*   **Arus Kas**: Dana masuk ke saldo BOP berasal dari "Transfer Kas" (Mutasi Dana) dari Kas Utama (Cash/BCA) ke Akun BOP yang sesuai jenisnya (contoh: Kas Utama BCA -> BOP Jasa Angkut BCA).

## 2. Rencana Perubahan Backend

### 2.1. Konstanta (`app/utils/constants.py`)
Tambahkan jenis akun baru pada `KasBankJenis`:
```python
class KasBankJenis(str, Enum):
    CASH = "CASH"
    BANK_BCA = "BANK_BCA"
    # ...
    BOP_JASA_ANGKUT_CASH = "BOP_JASA_ANGKUT_CASH"
    BOP_JASA_ANGKUT_BCA = "BOP_JASA_ANGKUT_BCA"
    BOP_MOBIL_CASH = "BOP_MOBIL_CASH"
    BOP_MOBIL_BCA = "BOP_MOBIL_BCA"
```

### 2.2. Service Pengeluaran (`app/services/pengeluaran_service.py`)
Update schema dan create method agar user bisa memilih `KasBankJenis` sumber dana.
Jika `muatan_id` atau `mobil_id` ada, sistem secara cerdas bisa menyarankan penggunaan akun BOP terkait.

### 2.3. Transaksi Transfer Kas (`app/services/kas_bank_service.py`)
Meningkatkan kemudahan fitur transfer dana antar akun kas agar admin bisa "mengisi" saldo operasional supir atau showroom dengan satu klik.

### 2.4. Summary Khusus Modul
*   Update backend summary Jasa Angkut dan Mobil agar menyertakan total saldo BOP terkait dalam response JSON.

## 3. Rencana Perubahan Frontend

### 3.1. Dashboard / Dompet
*   Menampilkan ringkasan saldo untuk tiap akun operasional.
*   Tombol "Topup BOP" yang akan membuka form transfer dari Kas Utama.

### 3.2. Form Pengeluaran
*   Menambahkan dropdown "Sumber Dana" (Account selection).
*   Secara default, jika pengeluaran untuk Jasa Angkut, dropdown akan terpilih ke `BOP_JASA_ANGKUT_CASH` (tunai) atau `BOP_JASA_ANGKUT_BCA` (transfer).

### 3.3. Header Halaman Modul (Visibility)
*   **Modul Jasa Angkut**: Menampilkan total saldo operasional (`BOP_JASA_ANGKUT_CASH + BCA`) di header utama agar admin langsung tahu sisa dana "di jalan" untuk supir.
*   **Modul Showroom Mobil**: Menampilkan total saldo `BOP_MOBIL` di header untuk memantau dana perbaikan/persiapan unit yang tersedia.

## 4. Mekanisme Kerja

1.  **Pengisian (Top-up)**: Admin mentransfer dana dari Bank BCA ke akun `BOP_JASA_ANGKUT_BCA`. 
    - Saldo Bank BCA (Utama) berkurang.
    - Saldo `BOP_JASA_ANGKUT_BCA` bertambah.
    - Total uang di sistem (Arus Kas) tetap sama.
2.  **Pemakaian**: Saat supir butuh uang jalan tunai, admin mencatat mutasi `BOP_JASA_ANGKUT_BCA` -> `BOP_JASA_ANGKUT_CASH`, kemudian saat digunakan untuk BBM, memotong saldo `BOP_JASA_ANGKUT_CASH`.
3.  **Laporan**: Laporan Kas/Bank akan memisahkan mutasi tiap akun sehingga transparansi biaya operasional per divisi lebih jelas dan sinkron dengan wujud aslinya (Cash/Bank).

## 5. Penyesuaian Laporan Keuangan

Untuk menjaga transparansi, laporan keuangan perlu membedakan antara Kas Utama dan Saldo Operasional (BOP).

### 5.1. Laporan Neraca (`neraca.tsx` & `dashboard.py`)
*   **Backend**: Mengelompokkan `KasBankJenis` baru ke dalam kategori `kas_operasional` di response API.
*   **Frontend**: Menambahkan baris baru "Kas & Bank Operasional (BOP)" di bawah seksi Kas & Bank Utama.
*   **Tampilan**: Memisahkan total kas di tangan (`CASH`) dari saldo yang sedang dibawa supir (`BOP_*_CASH`).

### 5.2. Laporan Perubahan Modal (`perubahan-modal.tsx` & `dashboard.py`)
*   **Backend**: Memastikan rekonsiliasi Section D (Saldo Akhir) menjumlahkan semua akun BOP agar data tetap seimbang (Balanced).
*   **Frontend**: Menampilkan rincian saldo BOP pada bagian "F. Sisa Laba dan Modal" sehingga user tahu berapa dana yang masih "mengendap" di saldo operasional unit.

---
Rencana ini dibuat untuk memenuhi permintaan fitur saldo operasional tanpa merusak konsistensi data keuangan utama. 


