# Rencana Perbaikan Menu Bengkel

## Tujuan

Bikin alur bengkel lebih lengkap dan lebih aman kalau ada salah input, khususnya pembelian part/service, hutang piutang, dompet, absensi, kasbon, dan setor uang.

## Prioritas Pengerjaan

### 1. Edit Pembelian Part dan Service di Menu Bengkel

**Masalah:**
Kalau salah input pembelian part atau service, data belum bisa diedit.

**Rencana:**
- Tambah tombol `Edit` di riwayat pembelian part.
- Tambah tombol `Edit` di riwayat pembelian service.
- Form edit pakai data lama sebagai isi awal.
- Setelah disimpan, sistem update:
  - nominal transaksi
  - stok part jika terkait part
  - hutang jika pembelian secara hutang
  - saldo/dompet jika pembelian tunai
  - laporan keuangan terkait

**Catatan penting:**
Perlu validasi agar edit tidak bikin stok minus atau saldo tidak sesuai.

### 2. Hutang Piutang Bengkel, Jasa Angkut, dan JB Mobil

**Masalah:**
Input pembelian secara hutang belum muncul/terhubung jelas ke menu hutang piutang. Bayar hutang bengkel juga harus bisa dari menu bengkel.

**Rencana:**
- Tambah kategori hutang/piutang:
  - Bengkel
  - Jasa Angkut
  - JB Mobil
- Kalau pembelian bengkel dipilih `hutang`, otomatis masuk ke hutang piutang bengkel.
- Tambah fitur `Bayar Hutang` dari menu bengkel.
- Pembayaran hutang mengurangi saldo dompet bengkel.
- Riwayat pembayaran hutang tersimpan.

**Output:**
Admin bengkel bisa input pembelian hutang dan bayar hutang langsung dari menu bengkel.

### 3. Ubah Posisi Kotak Dompet dan Riwayat

**Masalah:**
Posisi kotak-kotak dompet dan riwayat ingin ditukar.

**Rencana:**
- Di halaman dompet/menu bengkel:
  - Kotak-kotak saldo/dompet dipindah ke bagian bawah.
  - Riwayat dipindah ke posisi atas.
- Pastikan tampilan tetap enak di desktop dan mobile.
- Kotak dompet tetap berisi ringkasan saldo, masuk, keluar, hutang, atau kategori lain yang dibutuhkan.

### 4. Tombol Kembali per Halaman

**Masalah:**
Saat klik `Kembali`, langsung balik ke awal, bukan balik satu halaman sebelumnya.

**Rencana:**
- Ubah behavior tombol `Kembali`.
- Pakai sistem history/navigation stack.
- Dari sub-menu balik ke menu sebelumnya.
- Dari detail balik ke list sebelumnya.
- Dari form balik ke halaman asal.
- Kalau tidak ada history, baru balik ke halaman utama.

**Contoh alur:**
`Bengkel > Pembelian Part > Detail Transaksi > Edit`

Klik kembali:
`Edit -> Detail Transaksi -> Pembelian Part -> Bengkel`

### 5. Master Data: Tampilan Angka Belum Link dengan Pusat

**Masalah:**
Angka di master data belum sama/terhubung dengan tampilan pusat.

**Rencana:**
- Cek sumber data angka di master data.
- Samakan sumber data dengan dashboard pusat.
- Pastikan format angka sama:
  - ribuan pakai format rupiah/number
  - total sesuai filter
  - data tidak dihitung beda antara pusat dan master data
- Jika pusat pakai API tertentu, master data ikut pakai API itu juga.
- Tambah pengecekan agar angka tidak kosong/beda karena filter tanggal atau role user.

### 6. Menu Absensi Dibuat Seperti Kalender

**Masalah:**
Absensi ingin model kalender, ada tanda tanggal sekarang.

**Rencana:**
- Ubah tampilan absensi jadi kalender bulanan.
- Tanggal hari ini diberi ciri visual.
- Tanggal yang sudah ada absensi diberi tanda.
- Tanggal belum absen diberi tanda beda.
- Bisa klik tanggal untuk lihat detail absensi.
- Tambah filter bulan dan tahun.

**Ciri visual:**
- Hari ini: highlight khusus.
- Sudah absen: warna/status hadir.
- Tidak hadir/izin/sakit: warna beda.
- Belum ada data: netral.

### 7. Admin Bengkel Tidak Bisa Input Kasbon/Pinjaman

**Masalah:**
Saat login sebagai admin bengkel, input kasbon/pinjaman tidak bisa.

**Rencana:**
- Cek permission role `admin bengkel`.
- Tambah akses untuk:
  - input kasbon
  - input pinjaman
  - lihat riwayat kasbon/pinjaman bengkel
- Pastikan data kasbon masuk ke cabang/menu bengkel yang benar.
- Jangan buka akses ke data cabang lain kalau tidak perlu.

### 8. Admin Bengkel Tidak Bisa Setor Uang Dompet

**Masalah:**
Admin bengkel tidak bisa setor uang dari dompet bengkel.

**Rencana:**
- Cek permission role `admin bengkel`.
- Tambah akses setor uang dompet.
- Form setor uang berisi:
  - nominal
  - sumber dompet
  - tujuan setor
  - tanggal
  - keterangan
- Setelah setor:
  - saldo dompet bengkel berkurang
  - riwayat transaksi tercatat
  - laporan pusat ikut update

## Urutan Implementasi Disarankan

1. Perbaiki permission admin bengkel.
2. Tambah fitur edit pembelian part dan service.
3. Hubungkan pembelian hutang ke hutang piutang.
4. Tambah bayar hutang dari menu bengkel.
5. Rapikan dompet dan posisi riwayat.
6. Perbaiki tombol kembali.
7. Sinkronkan angka master data dengan pusat.
8. Ubah absensi jadi kalender.

## Backlog Pekerjaan

### Sprint 1: Quick Fix dan Akses Admin Bengkel

#### BGK-001 - Perbaiki akses admin bengkel untuk kasbon/pinjaman

**Prioritas:** Tinggi

**Tipe:** Bugfix permission

**Deskripsi:**
Admin bengkel harus bisa input kasbon/pinjaman dari menu bengkel.

**Task teknis:**
- Cek role dan permission `admin bengkel`.
- Cek guard frontend yang menyembunyikan/mematikan tombol kasbon/pinjaman.
- Cek validasi backend untuk endpoint kasbon/pinjaman.
- Batasi data agar admin bengkel hanya akses data cabang/bengkel yang sesuai.

**Acceptance criteria:**
- Login sebagai admin bengkel bisa buka form kasbon/pinjaman.
- Bisa submit kasbon/pinjaman.
- Data masuk ke riwayat kasbon/pinjaman bengkel.
- Admin bengkel tidak bisa akses data cabang lain.

#### BGK-002 - Perbaiki akses admin bengkel untuk setor uang dompet

**Prioritas:** Tinggi

**Tipe:** Bugfix permission

**Deskripsi:**
Admin bengkel harus bisa setor uang dari dompet bengkel.

**Task teknis:**
- Cek role dan permission setor dompet.
- Cek tombol/form setor uang di frontend.
- Cek endpoint setor uang di backend.
- Pastikan saldo dompet bengkel berkurang setelah setor.
- Pastikan riwayat setor tercatat.

**Acceptance criteria:**
- Login sebagai admin bengkel bisa buka form setor uang.
- Bisa submit setor uang.
- Saldo dompet bengkel berubah sesuai nominal.
- Riwayat dompet mencatat transaksi setor.

#### BGK-003 - Tukar posisi riwayat dan kotak dompet

**Prioritas:** Sedang

**Tipe:** UI layout

**Deskripsi:**
Di halaman dompet/menu bengkel, riwayat ditaruh di atas dan kotak-kotak ringkasan dompet ditaruh di bawah.

**Task teknis:**
- Cari komponen halaman dompet bengkel.
- Pindahkan section riwayat ke atas.
- Pindahkan kotak ringkasan ke bawah.
- Tes tampilan desktop dan mobile.

**Acceptance criteria:**
- Riwayat tampil sebelum kotak-kotak dompet.
- Kotak dompet tetap tampil lengkap.
- Tidak ada layout pecah di mobile.

#### BGK-004 - Perbaiki tombol kembali agar mundur satu halaman

**Prioritas:** Sedang

**Tipe:** Navigasi UX

**Deskripsi:**
Tombol `Kembali` harus balik ke halaman sebelumnya, bukan langsung ke halaman awal.

**Task teknis:**
- Inventaris semua tombol `Kembali` di menu bengkel.
- Ganti navigasi hardcoded ke halaman awal dengan `router.back()` atau helper navigation yang sesuai.
- Tambah fallback ke halaman utama kalau tidak ada history.
- Tes alur dari list, detail, form tambah, dan form edit.

**Acceptance criteria:**
- Dari form balik ke halaman asal.
- Dari detail balik ke list.
- Dari sub-menu balik ke menu sebelumnya.
- Tidak langsung ke awal kecuali memang tidak ada history.

### Sprint 2: Edit Pembelian dan Hutang Piutang

#### BGK-005 - Tambah edit pembelian part

**Prioritas:** Tinggi

**Tipe:** Feature

**Deskripsi:**
User bisa edit transaksi pembelian part kalau ada salah input.

**Task teknis:**
- Cari model/API pembelian part.
- Tambah endpoint update pembelian part jika belum ada.
- Tambah tombol `Edit` di riwayat pembelian part.
- Buat form edit dengan data lama.
- Hitung ulang stok jika qty/part berubah.
- Hitung ulang dompet/hutang jika metode pembayaran berubah.

**Acceptance criteria:**
- Transaksi pembelian part bisa diedit.
- Stok part berubah benar setelah edit.
- Saldo/hutang berubah benar sesuai metode pembayaran.
- Edit gagal jika menyebabkan stok/saldo tidak valid.

#### BGK-006 - Tambah edit pembelian service

**Prioritas:** Tinggi

**Tipe:** Feature

**Deskripsi:**
User bisa edit transaksi pembelian service kalau ada salah input.

**Task teknis:**
- Cari model/API pembelian service.
- Tambah endpoint update pembelian service jika belum ada.
- Tambah tombol `Edit` di riwayat pembelian service.
- Buat form edit dengan data lama.
- Hitung ulang dompet/hutang jika nominal atau metode pembayaran berubah.

**Acceptance criteria:**
- Transaksi pembelian service bisa diedit.
- Saldo/hutang berubah benar setelah edit.
- Riwayat tetap rapi dan tidak membuat transaksi dobel.

#### BGK-007 - Hubungkan pembelian hutang bengkel ke hutang piutang

**Prioritas:** Tinggi

**Tipe:** Integrasi data

**Deskripsi:**
Pembelian bengkel dengan metode hutang otomatis muncul di hutang piutang kategori bengkel.

**Task teknis:**
- Cek struktur hutang/piutang yang sudah ada.
- Tambah kategori sumber `bengkel` jika belum ada.
- Saat pembelian part/service dipilih hutang, buat atau update catatan hutang.
- Pastikan nominal hutang tidak dobel saat transaksi diedit.
- Tampilkan hutang bengkel di menu hutang piutang.

**Acceptance criteria:**
- Pembelian hutang part masuk hutang piutang bengkel.
- Pembelian hutang service masuk hutang piutang bengkel.
- Edit transaksi hutang mengubah nominal hutang, bukan membuat dobel.
- Hutang bisa difilter berdasarkan kategori bengkel.

#### BGK-008 - Tambah bayar hutang dari menu bengkel

**Prioritas:** Tinggi

**Tipe:** Feature

**Deskripsi:**
Admin bengkel bisa bayar hutang bengkel langsung dari menu bengkel.

**Task teknis:**
- Tambah tombol/aksi `Bayar Hutang` di hutang bengkel.
- Buat form pembayaran hutang.
- Kurangi saldo dompet bengkel sesuai nominal bayar.
- Kurangi sisa hutang.
- Simpan riwayat pembayaran.

**Acceptance criteria:**
- Bisa bayar hutang sebagian.
- Bisa bayar hutang lunas.
- Saldo dompet bengkel berkurang.
- Status hutang berubah jika sudah lunas.
- Riwayat pembayaran tampil.

### Sprint 3: Sinkronisasi Data dan Absensi

#### BGK-009 - Sinkronkan angka master data dengan pusat

**Prioritas:** Sedang

**Tipe:** Data consistency

**Deskripsi:**
Angka di master data harus sama dengan angka di pusat.

**Task teknis:**
- Identifikasi sumber angka di dashboard pusat.
- Identifikasi sumber angka di master data.
- Samakan query/API atau helper hitung.
- Samakan format rupiah/angka.
- Cek pengaruh filter tanggal, cabang, dan role.

**Acceptance criteria:**
- Total di master data sama dengan pusat untuk filter yang sama.
- Format angka konsisten.
- Tidak ada angka kosong kalau data tersedia.

#### BGK-010 - Ubah absensi jadi tampilan kalender

**Prioritas:** Sedang

**Tipe:** UI feature

**Deskripsi:**
Menu absensi tampil seperti kalender dan tanggal hari ini punya tanda visual.

**Task teknis:**
- Cari halaman absensi sekarang.
- Buat tampilan kalender bulanan.
- Tambah highlight tanggal hari ini.
- Tambah indikator status absensi per tanggal.
- Tambah navigasi bulan/tahun.
- Detail absensi muncul saat tanggal diklik.

**Acceptance criteria:**
- Absensi tampil kalender.
- Tanggal hari ini terlihat jelas.
- Tanggal berisi absensi punya indikator.
- Bisa pindah bulan/tahun.
- Klik tanggal menampilkan detail absensi.

## Yang Bisa Dieksekusi Dulu

### Eksekusi 1 - Permission admin bengkel

Mulai dari `BGK-001` dan `BGK-002`.

**Alasan:**
- Dampak langsung ke user.
- Risiko lebih kecil daripada edit transaksi.
- Biasanya hanya menyentuh permission, guard UI, dan endpoint yang sudah ada.
- Bisa dites cepat dengan login admin bengkel.

**Output awal yang diharapkan:**
- Admin bengkel bisa input kasbon/pinjaman.
- Admin bengkel bisa setor uang dompet.

### Eksekusi 2 - UI ringan tanpa ubah data besar

Lanjut `BGK-003` dan `BGK-004`.

**Alasan:**
- Tidak banyak menyentuh logic keuangan.
- Bisa memperbaiki pengalaman pakai dengan cepat.
- Risiko data kecil.

**Output awal yang diharapkan:**
- Posisi riwayat dan kotak dompet sudah sesuai.
- Tombol kembali tidak lompat langsung ke awal.

### Eksekusi 3 - Hutang piutang dan edit transaksi

Kerjakan `BGK-005`, `BGK-006`, `BGK-007`, dan `BGK-008` setelah alur data dipetakan.

**Alasan:**
- Ini paling penting, tapi risiko paling besar.
- Edit transaksi menyentuh stok, saldo, hutang, dan laporan.
- Perlu audit sumber data supaya tidak muncul selisih atau dobel transaksi.

**Output awal yang diharapkan:**
- Pembelian part/service bisa diedit.
- Pembelian hutang otomatis masuk hutang piutang.
- Bayar hutang bisa dari menu bengkel.

### Eksekusi 4 - Sinkronisasi dan absensi

Kerjakan `BGK-009` dan `BGK-010` setelah fitur utama bengkel stabil.

**Alasan:**
- Sinkron angka butuh tracing lintas halaman.
- Absensi kalender lebih banyak di UI, tapi tetap perlu pastikan data tanggal benar.

**Output awal yang diharapkan:**
- Angka master data sama dengan pusat.
- Absensi tampil kalender dengan tanda tanggal hari ini.

## Risiko Teknis

- Edit transaksi bisa mempengaruhi stok, saldo, hutang, dan laporan.
- Hutang piutang perlu sumber data jelas supaya tidak dobel.
- Permission admin bengkel harus dibatasi agar tidak bisa akses data luar bengkel.
- Tombol kembali perlu dites di semua menu agar alur tidak rusak.
- Angka master data harus pakai sumber hitung yang sama dengan pusat.

## Checklist Testing

- Bisa edit pembelian part.
- Bisa edit pembelian service.
- Edit pembelian part mengubah stok dengan benar.
- Pembelian hutang masuk ke hutang piutang bengkel.
- Bisa bayar hutang dari menu bengkel.
- Saldo dompet berkurang saat bayar hutang.
- Admin bengkel bisa input kasbon/pinjaman.
- Admin bengkel bisa setor uang.
- Riwayat dompet dan kotak saldo tampil sesuai posisi baru.
- Tombol kembali balik satu halaman, bukan langsung ke awal.
- Angka master data sama dengan pusat.
- Absensi tampil kalender dan tanggal hari ini terlihat jelas.
