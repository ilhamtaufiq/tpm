# Financial Synchronization Logic (Sinkronisasi Laporan)

Dokumen ini menjelaskan hubungan antara **Laba Rugi**, **Perubahan Modal**, dan **Neraca** agar semua laporan tetap konsisten.

## 1. Tiga Laporan, Tiga Sudut Pandang
- **Laba Rugi**: performa periode.
- **Perubahan Modal**: bagaimana laba, setoran modal, dan prive mengubah ekuitas.
- **Neraca**: posisi aset, liabilitas, dan ekuitas pada satu tanggal snapshot.

## 2. Golden Relationship
Secara konsep:
```text
Laba Bersih periode
  -> menambah Perubahan Modal periode
  -> terkumpul menjadi Laba Ditahan di Neraca
```

Karena itu, jika periode dan tanggal dibandingkan dengan benar:
```text
Laba Bersih (Laba Rugi)
≈ perubahan laba pada laporan Perubahan Modal
≈ perubahan retained earnings yang tercermin di Neraca
```

## 3. Aturan Tanggal
- Laba Rugi dan Perubahan Modal memakai rentang:
  - `tanggal_dari`
  - `tanggal_sampai`
- Neraca memakai snapshot:
  - `as_of_date`
- Saat membandingkan, `as_of_date` harus sama dengan `tanggal_sampai`.
- Jika tidak, laporan bisa sama-sama benar tetapi tampak tidak sinkron.

## 4. Retained Earnings
Laba ditahan dihitung kumulatif dari awal histori sampai `as_of_date`.

Komponen yang perlu ikut diperhitungkan:
- laba unit Bengkel,
- laba unit Mobil,
- laba unit Jasa Angkut,
- beban operasional,
- gaji/lembur,
- bagian laba investor,
- eliminasi internal,
- prive.

## 5. Bottom-Up Equity
Neraca membangun equity dari komponen:
1. setoran modal kas,
2. setoran modal non-kas,
3. laba ditahan,
4. dikurangi prive.

Ini sengaja berbeda dari sekadar `Assets - Liabilities`, karena pendekatan bottom-up membuat selisih terlihat sebagai sinyal bug/data issue, bukan disembunyikan.

## 6. Modal Non-Kas
Modal non-kas muncul dari aset/stok yang ada tetapi tidak memiliki jejak pembelian kas/hutang yang cukup.

Yang **tidak boleh** dianggap modal non-kas:
- kasbon karyawan,
- piutang lainnya,
- piutang operasional unit,
- piutang internal.

## 7. Internal Elimination
Saat Bengkel memperbaiki mobil stok sendiri:
- unit Bengkel dapat melihat pendapatan,
- unit Mobil menerima kapitalisasi biaya,
- tetapi perusahaan belum menghasilkan laba eksternal.

Karena itu, `internal_elimination` harus:
- mengurangi laba konsolidasi selama mobil belum terjual,
- ikut memengaruhi modal dan neraca,
- dilepas saat mobil sudah terjual.

## 8. Sinkronisasi Kas
Total saldo kas/bank di Neraca harus cocok dengan saldo akhir laporan mutasi kas/bank untuk tanggal yang sama.

Jika tidak cocok, cek:
- akun `KasBankJenis`,
- transaksi manual vs otomatis,
- transaksi yang dibatalkan tetapi belum direversal,
- penggunaan `kas_jenis` eksplisit.

## 9. Urutan Debugging Saat Laporan Tidak Sinkron
1. Samakan dulu parameternya: periode dan snapshot date.
2. Bandingkan saldo kas akhir dengan mutasi kas/bank.
3. Cek `reports/base.py` untuk agregasi sumber.
4. Cek gaji, investor sharing, dan internal elimination.
5. Cek `neraca_service.py` untuk modal non-kas dan selisih.

## 10. Down Payment (Uang Muka Penjualan)
- DP dicatat sebagai Hutang (Uang Muka Penjualan) sampai transaksi diselesaikan.
- Di `modal_service.py`, perhitungan `kewajiban_usaha` mengambil `hutang_usaha_total` yang sudah termasuk DP. **Jangan** menambahkan `+ customer_dp` lagi — menyebabkan double-counting (modal aktual turun palsu).
- Di `reports/base.py`, query `direct_bengkel_dp` dan `bengkel_dp` tidak boleh memfilter keluar transaksi berstatus `LUNAS` jika ada kelebihan bayar (`jumlah_bayar > grand_total`), agar DP tetap diakui sebagai liabilitas.
