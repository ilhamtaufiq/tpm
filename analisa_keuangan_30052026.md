# Analisa Flow Keuangan TPM

Tanggal analisa: 30 Mei 2026  
Scope: backend dan frontend flow keuangan untuk Bengkel, Jasa Angkut, Jual Beli Mobil, Kas/Bank, Piutang, Hutang, Neraca, Laba Rugi, dan Perubahan Modal.

## Ringkasan Eksekutif

Sistem keuangan TPM memakai model hybrid:

- `KasBank` adalah ledger kas/bank untuk semua pergerakan uang.
- `PiutangUsaha` dan `HutangUsaha` menyimpan posisi tagihan dan kewajiban.
- Transaksi unit bisnis seperti Bengkel, Jasa Angkut, dan Mobil menjadi sumber operasional.
- Laporan konsolidasi dihitung ulang dari data transaksi melalui `BaseReportService`.

Secara konsep, arsitektur sudah cukup kuat karena memisahkan:

- Pergerakan kas: masuk/keluar uang.
- Akrual: piutang, hutang, beban belum dibayar, pendapatan belum diterima.
- Unit bisnis: Bengkel, Jasa Angkut, Jual Beli Mobil.
- Konsolidasi: eliminasi internal dan rekap laporan keuangan.

Perbaikan terakhir membuat hutang manual non-pinjaman, contoh "Hutang Warung", diperlakukan benar sebagai beban akrual:

```text
Dr Beban Operasional / Beban Umum   xxx
Cr Hutang Lainnya / Manual Unit     xxx
```

Sedangkan hutang yang memang pinjaman kas tetap diperlakukan sebagai:

```text
Dr Kas/Bank                         xxx
Cr Hutang                           xxx
```

Dengan aturan ini, Neraca dan Perubahan Modal menjadi lebih sesuai prinsip akuntansi.

## Komponen Data Utama

### 1. KasBank

Model: `backend/app/models/keuangan.py`  
Service: `backend/app/services/kas_bank_service.py` dan `backend/app/services/kas_bank_integration.py`

Fungsi:

- Mencatat semua mutasi uang.
- Memiliki `jenis` untuk lokasi kas/bank.
- Memiliki `sumber` untuk konteks transaksi.
- Menyimpan saldo berjalan lewat `saldo_sebelum` dan `saldo_sesudah`.

Jenis kas/bank penting:

| Jenis | Fungsi |
| --- | --- |
| `KAS_UNIT_BENGKEL` | Kas operasional Bengkel |
| `KAS_UNIT_JASA_ANGKUT` | Kas operasional Jasa Angkut |
| `KAS_UNIT_MOBIL` | Kas operasional Jual Beli Mobil |
| `KAS_UTAMA` | Kas pusat |
| `BANK_UTAMA` | Bank pusat |
| `BANK_BCA`, `BANK_MANDIRI`, dll | Rekening bank legacy/umum |

Mapping otomatis:

- `TRANSFER` secara default masuk ke `BANK_UTAMA`.
- `TUNAI` untuk sumber unit masuk ke kas unit masing-masing.
- Sumber non-unit default ke `KAS_UTAMA`.

Catatan risiko:

- `KasBank` adalah ledger saldo berjalan. Jika ada transaksi lama diedit/dihapus tanpa recalculation saldo setelahnya, saldo historis bisa bergeser.
- Penggunaan `allow_negative` harus dibatasi karena bisa membuat kas unit minus tanpa kontrol operasional.

## Flow Hutang

Service: `backend/app/services/hutang_service.py`  
Frontend utama: `frontend/app/finance/hutang.tsx`

### Jenis Hutang

| Sumber | Arti | Dampak laporan |
| --- | --- | --- |
| `PEMBELIAN_PART` | Hutang supplier sparepart | Hutang Pembelian Part |
| `PEMBELIAN_MOBIL` | Hutang beli mobil | Hutang Pembelian Mobil |
| `JUAL_BELI_MOBIL` | Hutang internal/terkait mobil | Hutang Pembelian Mobil atau internal sesuai flag |
| `LAINNYA` | Hutang manual unit atau umum | Hutang Lainnya / Manual Unit |

### Hutang Manual Non-Pinjaman

Contoh: "Hutang Makan di Warung" dari Unit Bengkel, nominal 2.300.000, tanpa pilih Cash/Transfer/Split.

Akuntansi:

```text
Dr Beban Operasional                2.300.000
Cr Hutang Lainnya / Manual Unit     2.300.000
```

Dampak:

- Kas tidak berubah.
- Hutang naik.
- Laba turun.
- Laba ditahan turun.
- Modal akhir turun.
- Neraca tetap balance.

Implementasi report:

- Hutang `LAINNYA` tetap masuk `hutang_lainnya`.
- Jika tidak ada `KasBank MASUK` yang terkait dengan hutang tersebut, maka dianggap `manual_hutang_non_pinjaman` dan dimasukkan ke beban operasional konsolidasi.

### Hutang Pinjaman Kas

Contoh: perusahaan menerima pinjaman tunai 5.000.000 dan user memilih Cash/Transfer/Split.

Akuntansi:

```text
Dr Kas/Bank                         5.000.000
Cr Hutang                           5.000.000
```

Dampak:

- Kas naik.
- Hutang naik.
- Laba tidak berubah.
- Modal tidak berubah.
- Neraca tetap balance.

### Pembayaran Hutang

Akuntansi:

```text
Dr Hutang                           xxx
Cr Kas/Bank                         xxx
```

Implementasi:

- Membuat `PembayaranHutang`.
- Mengurangi `sisa_hutang`.
- Membuat `KasBank KELUAR`.
- Jika sumber hutang pembelian part/mobil, status transaksi sumber ikut diperbarui.

Catatan risiko:

- Form "Metode Penerimaan" di hutang perlu label yang sangat jelas. Untuk user awam, istilah ini rawan disalahpahami sebagai metode pembayaran hutang, padahal maksudnya penerimaan uang pinjaman.

## Flow Piutang

Service: `backend/app/services/piutang_service.py`  
Frontend utama: `frontend/app/finance/piutang.tsx`

### Piutang Manual

Jika user membuat piutang manual dari unit dan memilih metode pembayaran, sistem mencatat kas keluar:

```text
Dr Piutang                          xxx
Cr Kas/Bank                         xxx
```

Contoh:

- Kasbon karyawan dari unit.
- Piutang umum dari unit.

Jika piutang dibuat tanpa kas keluar, maka hanya menjadi pencatatan tagihan akrual.

### Pembayaran Piutang

Akuntansi:

```text
Dr Kas/Bank                         xxx
Cr Piutang                          xxx
```

Implementasi:

- Membuat `PembayaranPiutang`.
- Mengurangi `sisa_piutang`.
- Membuat `KasBank MASUK`.
- Unit source diprioritaskan dari field `unit`.

Catatan risiko:

- Manual unit piutang dengan source unit akan dinormalisasi menjadi `LAINNYA` kecuali `KASBON_KARYAWAN`. Ini benar untuk laporan "Piutang Lainnya", tetapi harus dipahami oleh UI supaya label tidak membingungkan.

## Flow Bengkel

Service utama: `backend/app/services/transaksi_bengkel_service.py`  
Frontend utama: `frontend/app/bengkel/index.tsx`

### Penjualan/Jasa Bengkel Eksternal

Jika lunas:

```text
Dr Kas/Bank                         total bayar
Cr Pendapatan Bengkel               total penjualan
Dr HPP Sparepart                    harga beli part
Cr Persediaan Sparepart             harga beli part
```

Dalam sistem:

- Pendapatan dan HPP dihitung dari transaksi bengkel dan detail sparepart.
- Pembayaran membuat `KasBank MASUK` sumber `BENGKEL`.

Jika belum lunas:

```text
Dr Piutang Bengkel                  total tagihan
Cr Pendapatan Bengkel               total tagihan
```

Dalam sistem:

- Membuat `PiutangUsaha`.
- `sumber=BENGKEL` untuk eksternal.

### Bengkel Internal ke Jual Beli Mobil

Contoh: mobil stok diperbaiki di Bengkel.

Akuntansi konsolidasi:

- Di level unit, Bengkel punya pendapatan/piutang internal.
- Di level mobil, biaya menjadi nilai persediaan mobil.
- Di laporan konsolidasi, internal receivable/payable tidak dihitung sebagai aset/kewajiban eksternal.

Sistem:

- Piutang internal Bengkel dibuat.
- Hutang internal Mobil dibuat.
- Nilai perbaikan masuk ke stok mobil.
- Neraca melakukan tracing dan eliminasi internal.

Catatan penting:

- Untuk mobil belum terjual, perbaikan internal dikapitalisasi ke stok mobil.
- Untuk mobil sudah terjual, auto-sync melunaskan/menetralkan internal tertentu supaya tidak menggantung.

### Bengkel Internal ke Jasa Angkut

Contoh: armada Jasa Angkut service di Bengkel.

Akuntansi:

- Bengkel mendapat pendapatan internal.
- Jasa Angkut mendapat beban maintenance/repair.
- Secara konsolidasi, pendapatan internal dan beban internal perlu diperlakukan hati-hati agar laba tidak overstated.

Sistem:

- Kategori `jasa_angkut` mengarah ke armada.
- Cash/internal movement menggunakan sumber unit Jasa Angkut.
- Report Jasa Angkut membaca biaya bengkel sebagai maintenance.

## Flow Jasa Angkut

Service utama: `backend/app/services/muatan_service.py`  
Frontend utama: `frontend/app/jasa-angkut/index.tsx`

### Muatan Lunas

Pendapatan kotor dipisah menjadi:

- Bagian TPM.
- Laba supir.
- Biaya trip seperti BBM, tol, parkir, makan, dan biaya lainnya.

Default profit split: `JASA_ANGKUT_PROFIT_SPLIT = 0.5`.

Akuntansi ringkas:

```text
Dr Kas/Bank                         uang diterima
Cr Pendapatan Jasa Angkut           bagian pendapatan
Cr Hutang/Bagian Supir              jika ada bagian supir belum dibayar
Dr Beban Trip                       biaya operasional trip
Cr Kas/Bank                         biaya trip dibayar
```

Dalam sistem:

- `MuatanJasaAngkut` menyimpan pendapatan dan biaya trip.
- `KasBank` mencatat penerimaan dan pengeluaran bila dibayar.
- Jika belum lunas, sistem dapat membuat piutang terkait muatan.

### Biaya Armada

Biaya armada manual dicatat lewat `PengeluaranBengkel` dengan kategori bisnis `jasa_angkut`.

Dampak:

- Kas unit Jasa Angkut turun jika tunai/transfer.
- Beban Jasa Angkut naik.
- Laba Jasa Angkut turun.

## Flow Jual Beli Mobil

Service utama: `backend/app/services/mobil_service.py`  
Frontend utama: `frontend/app/mobil/index.tsx`

### Pembelian Mobil Tunai

```text
Dr Persediaan Mobil                 harga beli
Cr Kas/Bank                         harga beli
```

Dalam sistem:

- Mobil masuk stok.
- Kas keluar dari akun sesuai sumber pembayaran.
- Nilai stok mobil muncul di neraca.

### Pembelian Mobil Hutang

```text
Dr Persediaan Mobil                 harga beli
Cr Hutang Pembelian Mobil           sisa belum dibayar
Cr Kas/Bank                         dp jika ada
```

Dalam sistem:

- Membuat `HutangUsaha` sumber `PEMBELIAN_MOBIL`.
- Stok mobil tetap naik penuh.
- Hutang muncul di neraca.

### Penjualan Mobil

Jika lunas dan mobil terjual:

```text
Dr Kas/Bank                         harga jual
Cr Penjualan Mobil                  harga jual
Dr HPP Mobil                        harga beli + prep + repair
Cr Persediaan Mobil                 harga beli + prep + repair
Cr Hutang Investor                  bagian investor jika belum dicairkan
```

Dalam sistem:

- Revenue mobil dihitung dari transaksi penjualan.
- HPP mobil mencakup harga beli, biaya persiapan, dan repair.
- Investor sharing menjadi kewajiban investor sampai dicairkan.

### Booking / DP Mobil

Jika ada DP tetapi mobil belum final terjual:

- Kas bertambah.
- Belum dianggap revenue final.
- Di neraca diperlakukan sebagai uang muka/kewajiban sampai transaksi final.

## Flow Pengeluaran Umum dan Unit

Service: `backend/app/services/pengeluaran_service.py`

Pengeluaran tunai:

```text
Dr Beban Operasional                xxx
Cr Kas/Bank                         xxx
```

Pengeluaran kredit:

```text
Dr Beban Operasional                xxx
Cr Hutang / Accrued Expense         xxx
```

Sistem saat ini:

- Pengeluaran tunai membuat `PengeluaranBengkel` dan `KasBank KELUAR`.
- Pengeluaran kredit dihitung sebagai accrued liability di report via `PaymentMethod.KREDIT`.
- Hutang manual non-pinjaman juga dihitung sebagai beban akrual agar neraca seimbang.

Catatan risiko:

- Ada dua jalur untuk akrual beban: `PengeluaranBengkel.metode_bayar=KREDIT` dan `HutangUsaha.sumber=LAINNYA` tanpa kas masuk. Ini perlu dijaga agar tidak double input untuk kasus yang sama.

## Flow Modal dan Prive

### Setoran Modal

```text
Dr Kas/Bank                         xxx
Cr Modal Disetor                    xxx
```

Sistem:

- `KasBank MASUK` sumber `MODAL`.
- Di Neraca masuk `setoran_modal_kas`.

### Modal Non-Kas

Sistem mendeteksi aset/persediaan yang ada tetapi tidak memiliki pembayaran kas/hutang tercatat sebagai modal non-kas.

Tujuan:

- Menyeimbangkan data awal/import.
- Menghindari neraca tidak balance ketika stok/aset sudah ada sebelum semua histori pembayaran tercatat.

Risiko:

- Jika histori kas/hutang tidak lengkap, modal non-kas bisa menjadi "penampung" selisih.
- Perlu audit periodik agar modal non-kas bukan tempat menyembunyikan data input yang kurang lengkap.

### Prive

```text
Dr Prive / Pengurangan Modal        xxx
Cr Kas/Bank                         xxx
```

Di laporan:

- Neraca mengurangkan `prive` dari modal.
- Perubahan Modal menampilkan `prive` di pengurangan ekuitas.

## Laporan Keuangan

### Neraca

File backend: `backend/app/services/reports/neraca_service.py`  
Frontend: `frontend/app/laporan/neraca.tsx`

Komponen:

Aktiva:

- Kas tunai dan bank.
- Kas unit operasional.
- Piutang eksternal.
- Persediaan sparepart.
- Stok mobil termasuk biaya persiapan dan repair.
- Aset tetap.

Kewajiban:

- Hutang pembelian part.
- Hutang pembelian mobil.
- Hutang investor.
- Hutang lainnya/manual unit.
- Uang muka penjualan.
- Informasi hutang internal hanya sebagai trace, bukan kewajiban konsolidasi.

Modal:

- Setoran modal.
- Laba ditahan.
- Prive.
- Modal non-kas.

Rumus utama:

```text
Total Aktiva = Total Hutang + Total Modal
Modal = Setoran Modal + Laba Ditahan - Prive
```

Status setelah perbaikan:

- Hutang manual non-pinjaman menurunkan laba ditahan.
- Hutang manual pinjaman tidak menurunkan laba ditahan.
- Hutang Jasa Angkut manual tidak dipisah ke "Hutang Jasa Angkut"; tetap masuk "Hutang Lainnya / Manual Unit".

### Laba Rugi

File backend: `backend/app/services/reports/laba_rugi_service.py`

Sumber data:

- `BaseReportService.get_unit_financial_breakdown`.
- Unit Bengkel, Jasa Angkut, Mobil.
- Beban gaji, lembur, operasional, overhead, investor sharing, dan prive.

Catatan:

- Laba Rugi saat ini membaca beberapa breakdown dari `BaseReportService`, tetapi beberapa item baru seperti `manual_hutang_non_pinjaman` lebih eksplisit masuk ke retained earnings dan modal. Sebaiknya tampilan Laba Rugi juga diberi baris khusus "Beban Hutang Manual/Akrual" agar user bisa menelusuri rugi periode.

### Perubahan Modal

File backend: `backend/app/services/reports/modal_service.py`  
Frontend: `frontend/app/laporan/perubahan-modal.tsx`

Rumus:

```text
Modal Akhir = Modal Awal + Setoran Modal + Modal Non-Kas + Dana Investor + Laba/Rugi Periode - Prive - Pembayaran Investor
```

Penyajian setelah perbaikan:

- Laba bersih positif tampil di Penambahan.
- Rugi periode tampil di Pengurangan.
- Hutang manual non-pinjaman masuk ke beban umum, sehingga modal teoritis dan modal aktual kembali seimbang.

## Dompet Unit

Frontend:

- Bengkel: `frontend/app/bengkel/index.tsx`
- Jasa Angkut: `frontend/app/jasa-angkut/index.tsx`
- Mobil: `frontend/app/mobil/index.tsx`

Prinsip:

- Dompet unit mengambil saldo dari kas unit.
- Hutang/piutang aktif harus difilter berdasarkan `unit` dan status belum lunas.
- Bengkel sudah diperbaiki agar tidak hanya membaca `PEMBELIAN_PART`, tetapi semua hutang aktif `unit=BENGKEL`.

Query yang benar untuk kartu hutang unit:

```ts
useHutangList({
  limit: 20,
  status: 'BELUM_LUNAS',
  unit: '<UNIT>',
  sort_by: 'tanggal',
  sort_order: 'desc',
})
```

## Mapping Jurnal Praktis

| Skenario | Debit | Kredit | Catatan |
| --- | --- | --- | --- |
| Setoran modal kas | Kas/Bank | Modal Disetor | Menambah modal |
| Prive | Prive | Kas/Bank | Mengurangi modal |
| Hutang biaya manual non-pinjaman | Beban | Hutang Lainnya | Tidak ada kas masuk |
| Hutang pinjaman kas | Kas/Bank | Hutang | Ada kas masuk |
| Bayar hutang | Hutang | Kas/Bank | Mengurangi kewajiban |
| Piutang manual dengan kas keluar | Piutang | Kas/Bank | Contoh kasbon/piutang umum |
| Terima pembayaran piutang | Kas/Bank | Piutang | Mengurangi aset piutang |
| Penjualan bengkel tunai | Kas/Bank | Pendapatan Bengkel | Plus HPP part jika ada |
| Penjualan bengkel kredit | Piutang | Pendapatan Bengkel | Dibayar kemudian |
| Pembelian sparepart tunai | Persediaan Part | Kas/Bank | Stok naik |
| Pembelian sparepart hutang | Persediaan Part | Hutang Part | Stok naik, hutang naik |
| Pembelian mobil tunai | Persediaan Mobil | Kas/Bank | Stok mobil naik |
| Pembelian mobil hutang | Persediaan Mobil | Hutang Mobil | Stok mobil naik |
| Penjualan mobil | Kas/Piutang | Penjualan Mobil | HPP dan investor diproses di report |
| Muatan jasa angkut lunas | Kas/Bank | Pendapatan Jasa Angkut | Biaya trip dipisah sebagai beban |

## Temuan Utama

### 1. Core ledger sudah jelas tetapi belum full double-entry

Sistem menggunakan transaction ledger berbasis `KasBank`, bukan jurnal umum debit/kredit penuh. Ini masih bisa berjalan, tetapi laporan harus banyak melakukan rekonstruksi.

Dampak:

- Report service menjadi kompleks.
- Edge case seperti hutang manual non-pinjaman perlu aturan khusus.
- Risiko selisih lebih tinggi dibanding sistem jurnal umum.

Rekomendasi:

- Jangka pendek: dokumentasikan aturan mapping transaksi ke laporan.
- Jangka panjang: tambahkan tabel `journal_entries` dan `journal_lines`.

### 2. Hutang manual perlu tipe bisnis yang lebih eksplisit

Saat ini hutang manual dibedakan dari pinjaman berdasarkan ada/tidaknya `KasBank MASUK` terkait.

Ini bekerja, tetapi implicit.

Rekomendasi:

- Tambahkan field seperti `jenis_hutang_manual`:
  - `BEBAN_AKRUAL`
  - `PINJAMAN_KAS`
  - `PEMBELIAN_ASET`
  - `LAINNYA`
- UI bisa menampilkan pilihan yang lebih akuntabel.

### 3. Laba Rugi perlu transparansi beban akrual manual

Neraca dan Perubahan Modal sudah memasukkan hutang manual non-pinjaman sebagai beban. Laba Rugi sebaiknya juga menampilkan baris:

```text
Beban Hutang Manual / Akrual
```

Tujuan:

- User bisa menjelaskan mengapa laba/rugi turun.
- Menghindari pertanyaan "kenapa Laba Ditahan negatif".

### 4. Modal non-kas bisa menjadi area abu-abu

Modal non-kas membantu balancing data awal, tetapi perlu audit.

Rekomendasi:

- Tambahkan laporan detail modal non-kas: aset/stok apa saja dan kenapa dianggap modal.
- Pisahkan modal non-kas hasil import awal dari modal non-kas transaksi berjalan.

### 5. Internal transaction perlu aturan konsolidasi yang konsisten

Internal Bengkel ke Mobil dan Bengkel ke Jasa Angkut punya dampak berbeda:

- Mobil: sering dikapitalisasi ke stok.
- Jasa Angkut: menjadi beban maintenance.

Rekomendasi:

- Pertahankan flag `is_internal`.
- Buat dashboard rekonsiliasi internal piutang vs hutang.
- Jangan tampilkan internal payable sebagai kewajiban eksternal di Neraca konsolidasi.

## Checklist Validasi Operasional

Gunakan checklist ini setelah perubahan flow keuangan:

1. Buat hutang manual non-pinjaman 2.300.000 tanpa Cash/Transfer/Split.
   - Hutang Lainnya naik 2.300.000.
   - Kas tidak berubah.
   - Laba Ditahan turun 2.300.000.
   - Perubahan Modal menampilkan Rugi Periode sebagai Pengurangan.
   - Neraca balance.

2. Buat hutang pinjaman 2.300.000 dengan Cash/Transfer/Split.
   - Hutang naik 2.300.000.
   - Kas naik 2.300.000.
   - Laba Ditahan tidak turun.
   - Neraca balance.

3. Bayar hutang manual 1.000.000.
   - Kas turun 1.000.000.
   - Sisa hutang turun.
   - Tidak menambah beban lagi.
   - Neraca balance.

4. Buat piutang/kasbon dari unit.
   - Kas unit turun.
   - Piutang naik.
   - Laba tidak langsung berubah.
   - Neraca balance.

5. Terima pembayaran piutang.
   - Kas naik.
   - Piutang turun.
   - Neraca balance.

6. Pembelian part hutang.
   - Persediaan part naik.
   - Hutang part naik.
   - Tidak langsung menjadi beban.
   - Beban muncul saat part terjual/dipakai.

7. Pembelian mobil hutang.
   - Stok mobil naik.
   - Hutang mobil naik.
   - Tidak langsung menjadi beban.
   - HPP muncul saat mobil terjual.

8. Perbaikan mobil internal Bengkel.
   - Piutang internal Bengkel dan hutang internal Mobil sesuai.
   - Stok mobil naik jika mobil belum terjual.
   - Konsolidasi tidak menghitung internal payable sebagai hutang eksternal.

## Rekomendasi Prioritas

### Prioritas Tinggi

1. Tambahkan field eksplisit untuk tipe hutang manual.
2. Tambahkan baris beban hutang manual/akrual di Laba Rugi.
3. Buat test otomatis untuk skenario hutang manual non-pinjaman vs pinjaman kas.
4. Buat test otomatis untuk kartu dompet unit menampilkan hutang/piutang aktif berdasarkan `unit`.

### Prioritas Menengah

1. Buat rekonsiliasi internal piutang vs hutang di UI admin.
2. Tambahkan detail modal non-kas di laporan modal/neraca.
3. Buat util parsing number API agar Decimal string selalu dikonversi ke number di frontend.

### Prioritas Jangka Panjang

1. Migrasi bertahap ke jurnal umum double-entry.
2. Tambahkan chart of accounts.
3. Buat trial balance otomatis.
4. Audit trail untuk edit/hapus transaksi kas historis.

## Kesimpulan

Flow keuangan TPM saat ini sudah mendukung operasi multi-unit dan laporan konsolidasi. Titik paling penting adalah membedakan transaksi kas, transaksi akrual, dan transaksi internal. Setelah perbaikan terakhir, perlakuan hutang manual non-pinjaman sudah sesuai akuntansi: hutang menaikkan kewajiban dan sekaligus menurunkan laba/modal melalui beban akrual.

Area yang masih perlu diperkuat adalah eksplisitas jenis transaksi dan transparansi laporan. Dengan menambahkan tipe hutang manual, baris beban akrual di Laba Rugi, serta test otomatis untuk skenario kunci, sistem akan jauh lebih mudah diaudit dan lebih aman dari selisih neraca.
