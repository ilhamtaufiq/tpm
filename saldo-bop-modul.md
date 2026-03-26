# Perencanaan Fitur Saldo BOP (Biaya Operasional) Modul

Dokumen ini merinci rencana implementasi fitur saldo khusus untuk biaya operasional pada modul **Jasa Angkut** dan **Bengkel / Showroom Mobil** tanpa mengubah arus kas keseluruhan.

## 1. Konsep Dasar

Fitur ini akan menggunakan sistem `KasBank` yang sudah ada namun dengan kategori akun (`KasBankJenis`) yang dikhususkan untuk dana operasional modul tertentu.

*   **Saldo BOP Jasa Angkut**: Digunakan untuk membayar BBM, Tol, Makan, dan biaya perjalanan muatan lainnya.
*   **Saldo BOP Mobil / Showroom**: Digunakan untuk biaya perbaikan unit, salon, atau operasional showroom.
*   **Arus Kas**: Dana masuk ke saldo BOP berasal dari "Transfer Kas" (Mutasi Dana) dari Kas Utama (Cash/BCA) ke Akun BOP terkait.

## 2. Rencana Perubahan Backend

### 2.1. Konstanta (`app/utils/constants.py`)
Tambahkan jenis akun baru pada `KasBankJenis`:
```python
class KasBankJenis(str, Enum):
    CASH = "CASH"
    BANK_BCA = "BANK_BCA"
    # ...
    BOP_JASA_ANGKUT = "BOP_JASA_ANGKUT"
    BOP_MOBIL = "BOP_MOBIL"
```

### 2.2. Service Pengeluaran (`app/services/pengeluaran_service.py`)
Update schema dan create method agar user bisa memilih `KasBankJenis` sumber dana.
Jika `muatan_id` atau `mobil_id` ada, sistem secara cerdas bisa menyarankan penggunaan akun BOP terkait.

### 2.3. Transaksi Transfer Kas (`app/services/kas_bank_service.py`)
Meningkatkan kemudahan fitur transfer dana antar akun kas agar admin bisa "mengisi" saldo operasional supir atau showroom dengan satu klik.

## 3. Rencana Perubahan Frontend

### 3.1. Dashboard / Dompet
*   Menampilkan ringkasan saldo untuk tiap akun operasional.
*   Tombol "Topup BOP" yang akan membuka form transfer dari Kas Utama.

### 3.2. Form Pengeluaran
*   Menambahkan dropdown "Sumber Dana" (Account selection).
*   Secara default, jika pengeluaran untuk Jasa Angkut, dropdown akan terpilih ke `BOP_JASA_ANGKUT`.

## 4. Mekanisme Kerja

1.  **Pengisian**: Admin mentransfer dana dari Bank BCA ke akun `BOP_JASA_ANGKUT`. Saldo Bank BCA berkurang, Saldo BOP Jasa Angkut bertambah. Total uang di sistem (Arus Kas) tetap sama.
2.  **Pemakaian**: Saat supir butuh uang jalan, admin/kasir mencatat pengeluaran yang memotong `BOP_JASA_ANGKUT`. Uang di laci kasir (`CASH`) tidak terganggu.
3.  **Laporan**: Laporan Kas/Bank akan memisahkan mutasi tiap akun sehingga transparansi biaya operasional per divisi lebih jelas.

---
Rencana ini dibuat untuk memenuhi permintaan fitur saldo operasional tanpa merusak konsistensi data keuangan utama. 
Setelah rencana ini disetujui, kita bisa melanjutkan ke implementasi kode.
