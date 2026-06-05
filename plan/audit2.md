# Audit 2 - Hardening Data, Test Matrix, dan Kontrol Operasional TPM

Tanggal audit: 2026-06-05

Lanjutan dari: `plan/audit1.md`

Scope audit lanjutan:

- Invariant data yang harus selalu benar.
- Matrix skenario test end-to-end.
- Risiko endpoint update/delete/void/payment.
- Kontrol operasional untuk mencegah selisih laporan.
- Rekomendasi refactor bertahap tanpa menghentikan development fitur.

## Tujuan Audit 2

Audit 1 sudah memetakan proses bisnis dan risiko besar. Audit 2 mengubah temuan itu menjadi daftar kontrol yang bisa langsung dipakai untuk development, QA manual, dan test otomatis.

Target akhirnya:

- Setiap transaksi punya status yang jelas.
- Setiap dampak finansial bisa ditelusuri.
- Setiap laporan bisa direkonsiliasi.
- Setiap update/cancel punya pola reversal yang konsisten.
- UI membantu user memilih flow yang benar.

## Invariant Sistem

Invariant adalah aturan yang tidak boleh dilanggar oleh backend, walaupun frontend salah kirim payload.

### Invariant Bengkel

1. Transaksi `ANTRE` tidak boleh membuat:
   - `KasBank`
   - `PiutangUsaha`
   - `HutangUsaha`
   - revenue laporan
   - HPP laporan

2. Transaksi `PROSES` tidak boleh membuat efek finansial final, kecuali nanti bisnis memutuskan ada invoice terpisah.

3. Transaksi `SELESAI` dengan `grand_total > 0` harus punya salah satu:
   - kas masuk jika lunas
   - piutang aktif jika belum lunas/cicilan
   - settlement internal yang lengkap jika kategori internal

4. Transaksi `BATAL` harus:
   - tidak dihitung laporan
   - mengembalikan stok jika stok pernah dikurangi
   - membuat reversal jika sebelumnya sudah ada kas/piutang/hutang

5. Nominal `grand_total` tidak boleh negatif. Diskon tidak boleh lebih besar dari subtotal.

6. Payment `jumlah_bayar` tidak boleh negatif. Overpay harus jelas: kembalian dicatat atau payment dicap sampai grand total.

7. Item sparepart dengan stok normal tidak boleh membuat stok negatif. Item stok khusus `999` perlu didefinisikan sebagai unlimited/non-stock.

8. Update order yang sudah punya dampak finansial tidak boleh menghapus ledger tanpa reversal.

### Invariant Jual Beli Mobil

1. Satu mobil hanya boleh punya satu transaksi penjualan aktif.

2. Mobil `TERJUAL` harus punya transaksi penjualan aktif yang valid.

3. Mobil `BOOKING` harus punya DP/piutang/uang muka yang konsisten.

4. Mobil investor yang sudah dicairkan tidak boleh dibatalkan tanpa reversal investor.

5. Biaya internal bengkel untuk mobil harus punya referensi ke mobil dan transaksi bengkel.

6. Biaya mobil tidak boleh double count antara:
   - biaya lain-lain mobil
   - internal bengkel
   - pengeluaran manual
   - kas bank

7. Penjualan mobil lunas harus membuat kas masuk sesuai metode pembayaran.

8. Penjualan mobil belum lunas harus membuat piutang atau status tagihan yang dapat dilacak.

### Invariant Jasa Angkut

1. Muatan `BATAL` tidak boleh masuk pendapatan, piutang aktif, atau laporan laba.

2. Muatan belum bayar harus punya definisi piutang yang konsisten:
   - harga jual penuh, atau
   - margin/pendapatan kotor, atau
   - share TPM

   Pilihan ini harus ditetapkan sebagai rule bisnis tunggal.

3. Biaya operasional perjalanan tidak boleh dihitung dua kali dari `JasaAngkutBiayaLainnya`, `KasBank`, dan pengeluaran manual.

4. Repair bengkel untuk JA harus menjadi biaya JA, bukan pendapatan eksternal konsolidasi tanpa eliminasi.

5. Share supir harus jelas apakah:
   - langsung beban
   - hutang ke supir
   - hanya informasi operasional

6. Muatan internal harus punya flag eksplisit dan tidak masuk pendapatan eksternal.

### Invariant Keuangan

1. Semua `KasBank.nominal` harus lebih dari 0.

2. `KasBank.tipe` menentukan arah uang:
   - `MASUK` menaikkan saldo
   - `KELUAR` menurunkan saldo

3. Setiap KasBank non-manual harus punya:
   - `sumber`
   - `referensi_id`
   - `nomor_referensi`
   - keterangan yang informatif

4. Setiap pembayaran piutang harus:
   - mengurangi `sisa_piutang`
   - menaikkan `total_dibayar`
   - membuat kas masuk
   - update status transaksi asal bila relevan

5. Setiap pembayaran hutang harus:
   - mengurangi `sisa_hutang`
   - menaikkan `total_dibayar`
   - membuat kas keluar
   - update status transaksi asal bila relevan

6. Reversal harus berupa entry baru, bukan delete diam-diam.

7. Transfer internal harus balance:
   - kas keluar dari sumber
   - kas masuk ke tujuan
   - nominal sama
   - referensi sama

### Invariant Laporan

1. Laba rugi tidak boleh menghitung order `ANTRE/PROSES`.

2. Neraca harus balance setelah setiap transaksi finansial valid.

3. Piutang internal dan hutang internal harus dieliminasi pada laporan konsolidasi.

4. Laporan unit boleh menampilkan internal cost/revenue sebagai informasi, tetapi laporan perusahaan harus mengeliminasi double count.

5. Semua laporan berbasis tanggal harus memakai tanggal bisnis Asia/Jakarta.

6. Jika laporan memakai fallback berbasis teks keterangan, itu harus dianggap temporary risk dan masuk daftar refactor.

## Matrix Test End-to-End

### Bengkel - Umum

| Skenario | Ekspektasi Kas | Ekspektasi Piutang | Ekspektasi Laporan |
| --- | --- | --- | --- |
| Buat antrian tanpa item | tidak berubah | tidak ada | tidak berubah |
| Buat antrian dengan part/service | tidak berubah | tidak ada | tidak berubah |
| Update antrian tambah item sama | tidak berubah | tidak ada | tidak berubah |
| Proses order | tidak berubah | tidak ada | tidak berubah |
| Selesai belum bayar | tidak berubah | piutang naik | laba accrual dan neraca balance sesuai rule |
| Selesai bayar lunas tunai | kas unit bengkel naik | tidak ada/sisa 0 | laba naik, neraca balance |
| Selesai bayar split | akun kas/bank naik sesuai metode | tidak ada/sisa 0 | laba naik, neraca balance |
| Cicilan/DP | kas naik sebesar DP | sisa piutang aktif | neraca balance |
| Pelunasan piutang | kas naik | piutang turun ke 0 | total aktiva tetap proporsional |
| Batal sebelum selesai | tidak berubah | tidak ada | tidak berubah |
| Batal setelah lunas | reversal kas | piutang tidak aktif | laporan exclude/adjust |

### Bengkel - Internal Mobil

| Skenario | Ekspektasi |
| --- | --- |
| Antrian internal mobil belum selesai | tidak masuk laporan finansial |
| Selesai internal mobil | stok part turun, biaya mobil naik, piutang/hutang internal tercatat jika rule memakai internal AR/AP |
| Mobil belum terjual | laba konsolidasi tidak boleh overstated |
| Mobil terjual | HPP mobil mencakup biaya internal sesuai rule |
| Cancel penjualan mobil | internal settlement harus direversal/ditandai batal |

### Bengkel - Internal Jasa Angkut

| Skenario | Ekspektasi |
| --- | --- |
| Repair JA masih antre/proses | tidak masuk finance |
| Repair JA selesai | biaya JA naik, stok part turun, internal transfer balance |
| Muatan batal setelah repair | repair tetap biaya armada atau direversal sesuai rule bisnis |
| JA bayar/settle | kas/piutang sesuai source |

### Jual Beli Mobil

| Skenario | Ekspektasi |
| --- | --- |
| Beli mobil tunai | stok mobil naik, kas keluar, neraca balance |
| Beli mobil hutang | stok mobil naik, hutang naik |
| Booking dengan DP | kas naik, status booking, kewajiban/uang muka atau piutang sesuai rule |
| Penjualan lunas | kas naik, mobil terjual, laba terhitung |
| Penjualan cicilan | kas DP naik, piutang sisa bayar aktif |
| Pelunasan cicilan | kas naik, piutang lunas, mobil terjual bila rule mensyaratkan |
| Mobil investor lunas | laba investor/TPM benar |
| Pencairan investor | kas keluar, status pencairan tercatat |
| Cancel setelah investor cair | ditolak sampai reversal |

### Jasa Angkut

| Skenario | Ekspektasi |
| --- | --- |
| Muatan proses belum bayar | piutang sesuai rule jika invoice langsung, atau belum ada jika belum ditagih |
| Muatan selesai belum bayar | piutang aktif |
| Muatan lunas tunai/transfer | kas naik sesuai metode |
| Biaya operasional | kas keluar satu kali, biaya laporan satu kali |
| Muatan batal | tidak masuk revenue/laba, reversal jika ada pembayaran |
| Repair bengkel JA | biaya JA, bukan revenue eksternal konsolidasi |

### Keuangan Manual

| Skenario | Ekspektasi |
| --- | --- |
| Setoran modal | kas naik, modal naik |
| Prive | kas keluar, prive naik, bukan expense operasional |
| Transfer kas antar akun | kas sumber turun, kas tujuan naik, total kas sama |
| Pengeluaran umum | kas keluar, expense naik |
| Pembayaran hutang | kas keluar, hutang turun |
| Penerimaan piutang | kas masuk, piutang turun |

## Risiko Endpoint Mutasi

Berdasarkan pola endpoint/service, area berikut perlu audit detail sebelum perubahan besar.

### Endpoint Create

Risiko:

- Create langsung membuat beberapa side effect dalam satu request.
- Jika terjadi error setelah sebagian side effect dibuat, data bisa separuh jadi.
- Ada kemungkinan beberapa method melakukan lebih dari satu `commit()`.

Kontrol:

- Gunakan transaction boundary tunggal.
- Pakai `flush()` untuk mendapatkan ID, commit hanya sekali di akhir.
- Publish realtime event hanya setelah commit sukses.

### Endpoint Update

Risiko:

- Update data finansial setelah transaksi final dapat mengubah laporan historis.
- Replace detail dapat mengubah stok masa lalu.
- Update status bisa diam-diam membuat finance entry.

Kontrol:

- Update order draft/open bill boleh bebas.
- Update transaksi final harus menjadi adjustment.
- Simpan `updated_reason` untuk perubahan final.
- Bedakan endpoint:
  - update operational
  - finalize
  - payment
  - adjustment

### Endpoint Delete

Risiko:

- Delete pada transaksi yang sudah punya kas/piutang/hutang menghapus bukti historis.
- Soft delete mungkin belum difilter semua laporan.

Kontrol:

- Delete hanya untuk master data yang belum dipakai.
- Transaksi bisnis pakai `void`/`cancel`.
- Void membuat reversal dan status batal.
- Laporan wajib exclude void/batal.

### Endpoint Payment

Risiko:

- Payment duplicate jika user double tap atau retry request.
- Split payment total bisa berbeda dengan nominal transaksi.
- Payment tanpa idempotency key dapat menggandakan kas.

Kontrol:

- Tambahkan idempotency key per payment request.
- Validasi total split payment.
- Jika transaksi sudah lunas, reject payment tambahan kecuali adjustment/refund flow.
- Payment harus link ke piutang/hutang/transaksi asal.

### Endpoint Status

Risiko:

- Status kerja dan status bayar tercampur.
- Perubahan status ke selesai bisa membuat piutang/kas tanpa user sadar.

Kontrol:

- Status kerja tidak otomatis menjadi status bayar.
- Jika status selesai dan belum bayar, tampilkan aksi "Buat Tagihan/Piutang".
- Backend tetap boleh auto-create piutang jika itu rule final, tetapi UI harus eksplisit.

## Reconciliation Checklist

Checklist ini bisa dibuat menjadi endpoint atau script audit.

### KasBank

- [ ] Ada KasBank nominal `<= 0`?
- [ ] Ada KasBank tanpa `sumber`?
- [ ] Ada KasBank non-manual tanpa `referensi_id`?
- [ ] Ada transfer internal yang hanya punya satu sisi?
- [ ] Ada kas unit saldo negatif?
- [ ] Ada KasBank dengan sumber `BENGKEL` tetapi referensi order bukan `SELESAI`?
- [ ] Ada KasBank dengan nomor referensi duplicate tapi bukan split/transfer?

### Piutang

- [ ] Ada piutang sisa negatif?
- [ ] Ada piutang lunas tapi sisa masih > 0?
- [ ] Ada piutang belum lunas tapi sisa 0?
- [ ] Ada pembayaran piutang tanpa KasBank?
- [ ] Ada piutang referensi bengkel `ANTRE/PROSES`?
- [ ] Ada piutang internal yang ikut total konsolidasi?

### Hutang

- [ ] Ada hutang sisa negatif?
- [ ] Ada hutang lunas tapi sisa masih > 0?
- [ ] Ada pembayaran hutang tanpa KasBank?
- [ ] Ada hutang internal yang ikut total konsolidasi?

### Stok

- [ ] Ada stok sparepart negatif?
- [ ] Ada detail transaksi sparepart tanpa part?
- [ ] Ada transaksi batal tetapi stok belum dikembalikan?
- [ ] Ada pembelian part lunas/hutang yang stoknya tidak masuk?

### Laporan

- [ ] Neraca balance per akhir hari.
- [ ] Laba rugi periode sama dengan perubahan laba ditahan periode, setelah prive.
- [ ] Order bengkel `ANTRE/PROSES` tidak muncul di laba rugi.
- [ ] Muatan batal tidak muncul di laba rugi.
- [ ] Mobil batal tidak muncul di laba rugi.
- [ ] Piutang/hutang internal dieliminasi di neraca konsolidasi.

## Audit UI/UX Lanjutan

### Prinsip Label

Gunakan label yang menjelaskan konsekuensi bisnis, bukan hanya aksi teknis.

Disarankan:

- `Simpan Antrian`: tidak ada finance.
- `Simpan Update Order`: tidak ada payment baru.
- `Selesaikan Pekerjaan`: status kerja selesai.
- `Buat Tagihan`: create piutang jika belum bayar.
- `Bayar Sekarang`: buka bottom sheet pembayaran.
- `Pelunasan`: bayar sisa piutang.
- `Batalkan Order`: void/cancel dengan alasan.

Hindari:

- `Transaksi Berhasil` untuk antrian.
- `Simpan Transaksi` jika belum ada transaksi finansial.
- `Lunas` sebagai tombol jika user belum melihat nominal final.

### Status Badge

Pisahkan badge:

- Status Kerja:
  - Antre
  - Proses
  - Selesai
  - Batal

- Status Tagihan:
  - Belum Ditagih
  - Belum Bayar
  - Cicilan
  - Lunas
  - Batal

- Status Dokumen:
  - Order Slip
  - Invoice
  - Receipt

### Empty/Loading/Error

Screen yang wajib punya state jelas:

- Riwayat Bengkel
- Rincian Order
- Transaksi Bengkel
- Mutasi Kas
- Piutang
- Hutang
- Neraca
- Laba Rugi
- Perubahan Modal

Rekomendasi:

- Empty state harus memberi aksi berikutnya.
- Error state harus bisa retry.
- Loading pagination harus tidak menggeser layout besar.
- Search customer pakai debounce dan infinite query.

## Rekomendasi Refactor Bertahap

### Tahap 1 - Safety Net

Tanpa mengubah behavior besar:

- Tambahkan backend validation untuk nominal negatif.
- Tambahkan guard `ANTRE/PROSES` tidak boleh create KasBank/Piutang/Hutang.
- Tambahkan test integration kecil untuk Bengkel dan Neraca.
- Tambahkan unique constraint nomor transaksi.
- Tambahkan audit script reconciliation read-only.

### Tahap 2 - Settlement Layer

Mulai pisahkan pencatatan finansial:

- `WorkshopSettlementService`
- `CarSaleSettlementService`
- `TransportSettlementService`
- `ReceivableSettlementService`
- `PayableSettlementService`

Setiap service settlement harus punya:

- `finalize`
- `pay`
- `void`
- `reverse`
- `reconcile`

### Tahap 3 - Immutable Ledger

Ubah pola delete ledger menjadi reversal:

- Tambahkan kolom:
  - `is_reversal`
  - `reversal_of_id`
  - `void_reason`
  - `voided_by`
  - `voided_at`

- Aturan:
  - entry lama tidak dihapus
  - reversal entry berlawanan arah
  - laporan exclude/offset sesuai pair reversal

### Tahap 4 - Canonical Finance Classification

Buat klasifikasi transaksi agar laporan tidak bergantung teks.

Contoh field:

- `finance_category`: `revenue`, `cogs`, `expense`, `asset`, `liability`, `equity`, `internal`, `transfer`
- `business_unit`: `bengkel`, `mobil`, `jasa_angkut`, `central`
- `source_type`: nama model asal
- `source_id`: id model asal
- `settlement_status`: `draft`, `posted`, `reversed`, `void`

## Prioritas Bug yang Perlu Diburu Manual

### Prioritas 1

1. Buat antrian bengkel dengan item, cek apakah stok berkurang dan apakah finance tetap kosong.
2. Update antrian berkali-kali, cek stok akhir.
3. Selesaikan bengkel tanpa bayar, cek piutang dan neraca.
4. Bayar piutang bengkel, cek kas/piutang/neraca.
5. Void transaksi bengkel lunas, cek kas reversal dan stok.

### Prioritas 2

1. Buat repair internal mobil, jual mobil, cek laba rugi dan neraca.
2. Cancel penjualan mobil investor sebelum dan sesudah pencairan.
3. Buat muatan dengan biaya operasional, cek biaya tidak double.
4. Buat repair JA, cek laporan JA dan konsolidasi.
5. Transfer kas unit, cek total kas tidak berubah.

### Prioritas 3

1. Import/update stok part, cek nilai persediaan.
2. Slip gaji dan kasbon, cek kas/piutang karyawan.
3. Prive manual, cek perubahan modal.
4. Backup/restore, cek file upload dan database.
5. Public receipt, cek status dokumen sesuai transaksi.

## Definisi Done untuk Perubahan Finansial

Setiap PR atau perubahan yang menyentuh finance/laporan harus memenuhi:

- [ ] Ada penjelasan flow bisnis yang berubah.
- [ ] Ada test minimal untuk transaksi normal.
- [ ] Ada test untuk transaksi batal/void.
- [ ] Ada test laporan neraca balance.
- [ ] Ada test laba rugi tidak double count.
- [ ] Ada verifikasi UI status dan aksi.
- [ ] Ada update dokumentasi guardrail jika rule berubah.
- [ ] Tidak ada record Rp0 di KasBank/Piutang/Hutang kecuali memang ada rule eksplisit.

## Rancangan Audit Script

Script read-only yang disarankan:

```text
audit_finance_integrity.py
+-- check_zero_nominal_kasbank()
+-- check_unlinked_kasbank()
+-- check_bengkel_nonfinal_finance()
+-- check_negative_stock()
+-- check_piutang_status_consistency()
+-- check_hutang_status_consistency()
+-- check_internal_transfer_pairs()
+-- check_neraca_balance_by_date()
+-- print_findings_with_reference()
```

Output minimal:

```text
[CRITICAL] KasBank dari Bengkel non-final
  transaksi_id: 123
  nomor: BGL2606050001
  status_pengerjaan: PROSES
  kas_bank_id: 456
  nominal: 50000

[HIGH] Piutang lunas masih punya sisa
  piutang_id: 99
  nomor: AR2606050009
  sisa_piutang: 1000
```

## Kesimpulan Audit 2

TPM perlu diperlakukan sebagai sistem multi-ledger sederhana, bukan sekadar aplikasi CRUD. Risiko bug terbesar muncul ketika user melakukan update, batal, pelunasan, atau transaksi internal antar unit.

Langkah paling bernilai dalam jangka pendek:

1. Tambahkan test/invariant untuk Bengkel finance gate.
2. Tambahkan reconciliation script read-only.
3. Pisahkan status kerja dan status tagihan di UI.
4. Stop delete ledger untuk transaksi final; mulai gunakan reversal.
5. Tetapkan definisi piutang dan revenue Jasa Angkut secara eksplisit.

Jika lima hal itu dibereskan, risiko selisih neraca, laporan dobel, stok kacau, dan status transaksi ambigu akan turun signifikan.
