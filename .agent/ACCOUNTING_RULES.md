# Accounting Rules & Financial Logic

Dokumen ini menjelaskan aturan akuntansi khusus TPM yang harus dijaga agar laporan tetap konsisten.

## 1. Prinsip Dasar Neraca
Identitas utama:
```text
Assets = Liabilities + Equity
```

Namun sistem tidak sekadar memaksa persamaan itu. Equity dihitung secara bottom-up agar selisih nyata tetap terlihat bila ada data hilang atau bug.

## 2. Komponen Equity
- Setoran modal kas.
- Setoran modal non-kas.
- Laba ditahan.
- Dikurangi prive.

Jika hasilnya berbeda dari `Assets - Liabilities`, itu adalah sinyal investigasi, bukan angka yang boleh disamarkan.

## 3. Modal Non-Kas
Modal non-kas dihitung dengan mendeteksi aset/stok yang ada tanpa pasangan pembelian kas atau hutang yang memadai.

Yang dapat termasuk:
- stok spare part,
- stok mobil,
- aset tetap.

Yang harus dikecualikan:
- `Piutang Karyawan / Kasbon`,
- `Piutang Lainnya`,
- piutang operasional unit,
- piutang internal.

## 4. Internal Elimination
- Pendapatan Bengkel dari repair mobil stok sendiri belum boleh menjadi laba konsolidasi final selama mobil belum terjual.
- Nilai tersebut dieliminasi melalui `internal_elimination`.
- Saat mobil terjual, eliminasi dilepas dan laba menjadi terealisasi secara eksternal.

## 5. Kasbon Karyawan
- Klasifikasi: aset lancar berupa piutang, bukan beban dan bukan modal.
- Biasanya dilaporkan pada unit `LAINNYA` atau unit kerja karyawan.
- Pencairan dana harus jelas sumber wallet-nya.
- Pelunasan dapat terjadi manual atau lewat potongan payroll.

## 6. Routing Akun Kas/Bank
### Akun aktual (`KasBankJenis`)
- `CASH`: akun kas legacy/general.
- `BANK_BCA`, `BANK_MANDIRI`, `BANK_BRI`, `BANK_LAINNYA`: akun bank spesifik.
- `KAS_UTAMA`: kas pusat.
- `BANK_UTAMA`: bank pusat.
- `KAS_UNIT_BENGKEL`: kas lokal Bengkel.
- `KAS_UNIT_MOBIL`: kas lokal Jual Beli Mobil.
- `KAS_UNIT_JASA_ANGKUT`: kas lokal Jasa Angkut.

### Kebijakan Default
- Transfer -> `BANK_UTAMA`.
- Tunai/Internal dari unit -> wallet unit terkait.
- Transaksi non-unit/central -> `KAS_UTAMA`.
- Jika pilihan akun harus menyimpang dari default, kirim `kas_jenis` secara eksplisit.

## 7. Pengakuan dan Klasifikasi
- Pembelian stok bukan otomatis beban periode; stok menjadi aset sampai dijual.
- Gaji adalah beban yang harus ikut menurunkan laba.
- Bagian laba investor bukan equity perusahaan.
- Prive mengurangi modal, bukan beban operasional.

## 8. Down Payment (DP) / Uang Muka Penjualan
- DP yang diterima dari pelanggan sebelum transaksi selesai dicatat sebagai **Hutang (Uang Muka Penjualan)**.
- Saat transaksi selesai (SELESAI) dan fully paid, pos ini dihapus dan diakui sebagai pendapatan.
- Perhitungan `kewajiban_usaha` di `modal_service.py` tidak boleh double-counting `customer_dp` karena sudah termasuk di `hutang_usaha_total`.
- Query `direct_bengkel_dp` dan `bengkel_dp` di `reports/base.py` menghitung selisih `jumlah_bayar > grand_total` sebagai DP liability, terlepas dari `status_bayar`.

## 8. Aturan Audit Cepat
- Ada aset baru? cari kas keluar, hutang, atau modal non-kas.
- Ada piutang internal? pastikan hutang internal pasangannya ada.
- Ada laba naik tajam dari transaksi internal? cek eliminasi.
- Neraca seimbang terlalu “rapi” setelah patch? pastikan tidak ada adjustment paksa.
