# Financial Synchronization Logic (Sinkronisasi Laporan)

Dokumen ini menjelaskan hubungan antara tiga laporan utama: **Laba Rugi**, **Perubahan Modal**, dan **Neraca**. Sinkronisasi ini krusial agar laporan seimbang (Balanced).

## 1. Hubungan Antar Laporan (The Golden Equation)
Agar ketiga laporan sinkron, persamaan berikut harus terpenuhi:
```
Laba Bersih (Laba Rugi) = (Laba Periode - Total Beban & Prive) (Perubahan Modal)
                        = (Retained Earnings - Prive) (Neraca)
```

## 2. Parameter Penting (Mismatch Prevention)
- **Laba Rugi & Perubahan Modal**: Menggunakan range tanggal (`tanggal_dari` s/d `tanggal_sampai`).
- **Neraca**: Menggunakan snapshot (`as_of_date`).
- **Aturan**: Saat membandingkan ketiganya, `as_of_date` pada Neraca harus sama dengan `tanggal_sampai` pada Laba Rugi/Perubahan Modal.

## 3. Komponen Laba Ditahan (Retained Earnings)
Laba Ditahan di Neraca dihitung secara akumulatif sejak awal sistem berjalan hingga `as_of_date`. 
Komponen pengurang Laba (Beban) yang sering terlewat:
- **Gaji Karyawan**: Harus dikurangi dari Laba Kotor unit atau dimasukkan ke beban operasional pusat.
- **Sharing Investor**: Bagian laba untuk investor mobil harus dikeluarkan dari ekuitas perusahaan.
- **Eliminasi Internal**: Pendapatan bengkel dari repair mobil internal harus dieliminasi jika mobil belum terjual.

## 4. Mekanisme "Bottom-Up Equity"
Neraca di sistem ini tidak lagi menggunakan rumus `Equity = Assets - Liabilities` secara buta. Sebaliknya, Equity dihitung dari:
1. **Setoran Modal (Cash + Non-Kas)**
2. **(+) Laba Ditahan (Retained Earnings)**
3. **(-) Prive (Pengambilan Pemilik)**

Jika hasil perhitungan ini berbeda dengan `Assets - Liabilities`, maka muncul nilai **Selisih** di Neraca yang menunjukkan adanya kesalahan input data atau bug logika.

## 5. Sinkronisasi Kas
Total saldo Kas di Neraca (**Kas Tunai + Kas Bank + Kas Unit**) harus sama dengan saldo akhir yang ditampilkan di laporan mutasi kas/bank untuk periode yang sama.
