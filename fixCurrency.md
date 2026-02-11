# Dokumentasi Perbaikan Format Mata URL (IDR)

Dokumentasi ini menjelaskan standar penanganan format mata uang Rupiah (IDR) di aplikasi TPM agar tampilan sesuai standar Indonesia (misal: `Rp.500.000,00`) namun tetap aman untuk dikirim ke backend sebagai tipe data `number`.

## 1. Fungsi Utility Utama (`frontend/utils/format.ts`)

Gunakan fungsi-fungsi ini untuk menjaga konsistensi:

### `formatCurrency(amount: any)`
Digunakan untuk tampilan **read-only** (Label, List, Total).
- **Format:** `Rp.X.XXX.XXX,00`
- **Output:** String dengan awalan `Rp.`, pemisah ribuan titik, dan 2 desimal koma.

```typescript
export const formatCurrency = (amount: any): string => {
    let value: number;
    // ... logic parsing ...
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(safeAmount).replace(/Rp\s?/, 'Rp.');
};
```

### `formatNumber(value: string | number)`
Digunakan untuk tampilan **input field** saat mengetik.
- **Format:** `X.XXX.XXX`
- **Tujuan:** Memudahkan user membaca nominal besar di input tanpa prefiks `Rp` atau desimal.
- **Update:** Fungsi ini sekarang aman menangani data float dari API (misal: `600000.00` akan tetap jadi `600.000` dan bukan `60.000.000`).

```typescript
export const formatNumber = (value: string | number): string => {
    if (!value) return '';
    const stringValue = value.toString().replace(/\D/g, '');
    return stringValue.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};
```

### `parseNumber(value: string)`
Digunakan untuk **mengonversi input** kembali ke angka sebelum dikirim ke backend atau dijumlahkan.

```typescript
export const parseNumber = (value: string): number => {
    if (!value) return 0;
    return parseInt(value.replace(/\./g, ''), 10) || 0;
};
```

## 2. Pola Implementasi di Komponen

### A. Untuk Input Field (Editable)
Gunakan `formatNumber` di `onChangeText` dan pastikan `value` tetap string berformat saat ditampilkan.

```tsx
<Input
  label="Harga"
  value={item.harga.toString()}
  onChangeText={(val) => {
    const formatted = formatNumber(val); // Tampilan: 500.000
    // Simpan ke state
  }}
/>
```

### B. Untuk Label & Summary (Read-Only)
Gunakan `formatCurrency` langsung.

```tsx
<Typography>
  Total: {formatCurrency(total)} // Tampilan: Rp.500.000,00
</Typography>
```

### C. Saat Kirim ke API
Selalu jalankan `parseNumber` untuk memastikan data bersih dari karakter non-angka.

```typescript
const payload = {
  harga: Number(parseNumber(state.harga.toString())),
};
```

## 4. Daftar Field Nominal di Database/API

Berikut adalah daftar nama field yang biasanya menyimpan nilai uang (Nominal). Jika menemukan field ini, pastikan menggunakan `formatCurrency` untuk tampilan.

### A. Bengkel & Inventory
- `harga`: Harga Jasa atau Harga Unit.
- `harga_jual`: Harga jual Sparepart ke customer.
- `harga_beli`: Harga modal/beli Sparepart dari supplier.
- `grand_total`: Total akhir transaksi bengkel.
- `total_biaya`: Akumulasi biaya jasa dan part.
- `subtotal`: Nilai per baris (Qty x Harga).
- `jumlah_bayar`: Nominal yang dibayar customer di kasir.

### B. Keuangan & Kas
- `amount`: Field nominal umum di log aktivitas.
- `nominal`: Nilai transaksi masuk/keluar di Kas & Bank.
- `nominal_piutang`: Total hutang/piutang awal.
- `total_dibayar`: Akumulasi cicilan yang sudah masuk.
- `sisa_piutang`: Sisa hutang yang belum lunas.
- `saldo_sebelum` / `saldo_sesudah`: Catatan saldo di mutasi kas.
- `total_saldo`: Total uang di dashboard.

### C. SDM & Payroll
- `gaji_pokok`: Gaji dasar karyawan.
- `tunjangan`: Bonus atau uang tambahan.
- `nominal` (di Kasbon): Nilai pinjaman karyawan.
- `potongan_kasbon`: Nilai yang dipotong saat gajian.
- `gaji_bersih`: Total gaji yang diterima (Take Home Pay).
- `total_kasbon`: Sisa hutang kasbon karyawan.

### D. Jual Beli Mobil
- `harga_beli`: Modal pembelian unit mobil.
- `harga_jual`: Harga lepas unit ke buyer.
- `biaya_perbaikan`: Total modal perbaikan unit.
- `profit`: Selisih harga jual dan modal.

### E. Jasa Angkut (Ritase)
- `pendapatan_kotor`: Omset kotor dari satu kali trip.
*   **Biaya-biaya:** `biaya_bbm`, `biaya_tol`, `biaya_makan`, `biaya_parkir`, `biaya_lainnya`, `total_biaya`.
- `laba_kotor`: Selisih pendapatan kotor dan total biaya operasional.
- `laba_tpm`: Jatah keuntungan untuk kantor (TPM).
- `laba_supir`: Jatah keuntungan untuk supir.
- `total_hutang_supir`: Akumulasi piutang supir di dashboard.

## 5. Catatan Penting
- Jangan menggunakan `.toLocaleString('id-ID')` secara manual di banyak tempat, gunakan `formatCurrency` agar jika ada perubahan format (misal disuruh hapus desimal), cukup ubah di satu file `utils/format.ts`.
- Jika harga dari API datang dalam format `.00` (float), `parseNumber` akan menjaganya tetap integer jika menggunakan `parseInt`. Sesuaikan jika backend membutuhkan float.
