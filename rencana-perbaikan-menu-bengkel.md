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

### 3. Rapikan Flow Dompet dan Riwayat

**Masalah:**
Flow dompet bengkel perlu dirapikan, termasuk posisi section aksi dan riwayat.

**Rencana:**
- Di halaman dompet/menu bengkel:
  - Kotak saldo/dompet dan quick actions jadi section utama di atas.
  - Riwayat aktivitas kas dan setoran tampil di bawah.
- Pastikan tampilan tetap enak di desktop dan mobile.
- Kotak dompet tetap berisi ringkasan saldo, masuk, keluar, hutang, atau kategori lain yang dibutuhkan.
- Desain flow dompet ini jadi acuan bersama, lalu diimplementasikan juga ke unit bisnis Jual Beli Mobil dan Jasa Angkut setelah versi bengkel stabil.

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
2. Rapikan flow dompet dan tombol kembali.
3. Tambah edit pembelian part.
4. Tambah edit pembelian service.
5. Hubungkan pembelian hutang bengkel ke hutang piutang.
6. Tambah bayar hutang dari menu bengkel.
7. Sinkronkan angka master data dengan pusat.
8. Ubah absensi jadi kalender.
9. Replikasi flow dompet ke unit Jual Beli Mobil.
10. Replikasi flow dompet ke unit Jasa Angkut.

## Backlog Pekerjaan

## Progress Eksekusi

### Sudah dieksekusi
- [x] `BGK-001` - Perbaiki akses admin bengkel untuk kasbon/pinjaman
- [x] `BGK-002` - Perbaiki akses admin bengkel untuk setor uang dompet
- [x] `BGK-003` - Rapikan flow dompet bengkel
- [x] `BGK-004` - Perbaiki tombol kembali agar mundur satu halaman
- [x] `BGK-005` - Tambah edit pembelian part *(sudah dieksekusi, perlu testing)*
- [x] `BGK-007` - Hubungkan pembelian hutang bengkel ke hutang piutang *(sudah berjalan untuk pembelian part; scope service belum ada modulnya)*
- [x] `BGK-008` - Tambah akses bayar hutang/piutang bengkel via CTA ke halaman finance terfilter unit *(perlu testing end-to-end)*

### Belum dieksekusi
- [ ] `BGK-006` - Tambah edit pembelian service *(pending klarifikasi; entitas pembelian service terpisah belum ada di codebase)*
- [x] `BGK-009` - Sinkronkan angka master data dengan pusat *(sudah dieksekusi, perlu testing)*
- [x] `BGK-010` - Ubah absensi jadi tampilan kalender *(sudah dieksekusi, perlu testing)*
- [ ] `BGK-011` - Adaptasi flow dompet ke unit Jual Beli Mobil
- [ ] `BGK-012` - Adaptasi flow dompet ke unit Jasa Angkut

### Sprint 1: Quick Fix dan Akses Admin Bengkel

#### BGK-001 - Perbaiki akses admin bengkel untuk kasbon/pinjaman ✅

**Status:** Selesai dieksekusi

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

#### BGK-002 - Perbaiki akses admin bengkel untuk setor uang dompet ✅

**Status:** Selesai dieksekusi

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

#### BGK-003 - Rapikan flow dompet bengkel ✅

**Status:** Selesai dieksekusi

**Prioritas:** Sedang

**Tipe:** UI layout

**Deskripsi:**
Di halaman dompet/menu bengkel, flow dompet dirapikan dengan kotak saldo dan quick actions di atas, lalu riwayat aktivitas kas di bawah.

**Task teknis:**
- Cari komponen halaman dompet bengkel.
- Pastikan section saldo/dompet tampil sebagai section utama di atas.
- Pastikan quick actions dompet tampil sebelum riwayat.
- Pindahkan riwayat aktivitas kas ke bawah.
- Tes tampilan desktop dan mobile.

**Acceptance criteria:**
- Kotak saldo/dompet tampil di atas.
- Quick actions dompet tampil jelas di area utama.
- Riwayat tampil di bawah section dompet.
- Tidak ada layout pecah di mobile.

#### BGK-004 - Perbaiki tombol kembali agar mundur satu halaman ✅

**Status:** Selesai dieksekusi

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

#### BGK-005 - Tambah edit pembelian part ✅

**Status:** Sudah dieksekusi, perlu testing end-to-end

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

**Status:** Pending klarifikasi bisnis

**Prioritas:** Tinggi

**Tipe:** Feature

**Deskripsi:**
User bisa edit transaksi pembelian service kalau ada salah input.

**Catatan hasil cek codebase:**
- Saat ini tidak ada entitas `pembelian service` terpisah di backend/frontend.
- Yang ada hanya:
  - master `JasaServis`
  - `detail_services` pada transaksi penjualan bengkel
  - `PembelianSparePart` untuk pembelian vendor
- Jadi item ini belum bisa dikerjakan sebagai edit flow existing tanpa definisi modul baru.

**Task teknis:**
- Klarifikasi dulu apakah yang dimaksud:
  - pembelian jasa/vendor baru, atau
  - edit jasa pada transaksi penjualan bengkel.
- Jika memang perlu pembelian jasa/vendor, buat desain model/API/UI baru dulu.
- Setelah scope jelas, baru tambah endpoint update dan form edit.

**Acceptance criteria:**
- Scope bisnis pembelian service terdefinisi jelas.
- Jika modul baru dibuat, transaksi pembelian service bisa diedit.
- Saldo/hutang berubah benar setelah edit.
- Riwayat tetap rapi dan tidak membuat transaksi dobel.

#### BGK-007 - Hubungkan pembelian hutang bengkel ke hutang piutang ✅

**Status:** Selesai untuk flow pembelian part yang memang ada di sistem

**Prioritas:** Tinggi

**Tipe:** Integrasi data

**Deskripsi:**
Pembelian bengkel dengan metode hutang otomatis muncul di hutang piutang kategori bengkel.

**Task teknis:**
- Cek struktur hutang/piutang yang sudah ada.
- Pastikan pembelian part dengan sisa hutang membuat catatan hutang unit bengkel.
- Saat transaksi pembelian part diedit, nominal hutang lama diupdate tanpa dobel.
- Tampilkan hutang bengkel di menu hutang/piutang via halaman finance terfilter unit.
- Pastikan role bengkel hanya melihat data hutang/piutang unit bengkel.

**Acceptance criteria:**
- Pembelian hutang part masuk hutang piutang bengkel.
- Edit transaksi hutang part mengubah nominal hutang, bukan membuat dobel.
- Hutang bisa difilter berdasarkan kategori/unit bengkel.
- Role bengkel tidak bisa melihat hutang unit lain.

#### BGK-008 - Tambah bayar hutang dari menu bengkel ✅

**Status:** Sudah dieksekusi via CTA ke halaman finance terfilter unit, perlu testing end-to-end

**Prioritas:** Tinggi

**Tipe:** Feature

**Deskripsi:**
Admin bengkel bisa masuk ke daftar hutang/piutang bengkel dari menu bengkel lalu memproses pembayaran pada data unit bengkel saja.

**Task teknis:**
- Tambah CTA `Hutang` dan `Piutang` di flow dompet bengkel.
- Arahkan ke halaman finance dengan filter `unit=BENGKEL`.
- Izinkan role bengkel mengakses screen hutang/piutang finance yang sudah dibatasi per unit.
- Pastikan pembayaran tetap mengurangi saldo wallet unit bengkel.
- Pastikan data dan aksi tetap scoped ke unit bengkel.

**Acceptance criteria:**
- Dari menu bengkel bisa buka daftar hutang bengkel.
- Dari menu bengkel bisa buka daftar piutang bengkel.
- Pembayaran hutang/piutang hanya memproses data unit bengkel.
- Saldo dompet bengkel dan riwayat tetap tercatat benar.

### Sprint 3: Sinkronisasi Data dan Absensi

#### BGK-009 - Sinkronkan angka master data dengan pusat ✅

**Status:** Sudah dieksekusi, perlu testing visual dan data sampling

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

**Catatan implementasi:**
- Halaman customer, supplier, jasa servis, dan asset diubah agar memakai `total` dari metadata API, bukan `data.length` hasil pagination terbatas.
- Halaman sparepart diubah agar angka low stock memakai endpoint low-stock khusus, supaya konsisten dengan inventory pusat.

**Acceptance criteria:**
- Total di master data sama dengan pusat untuk filter yang sama.
- Format angka konsisten.
- Tidak ada angka kosong kalau data tersedia.

#### BGK-010 - Ubah absensi jadi tampilan kalender ✅

**Status:** Sudah dieksekusi, perlu testing UX dan validasi data status

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

**Catatan implementasi:**
- Kalender bulanan dipakai sebagai tampilan utama absensi.
- Hari ini diberi highlight border hijau.
- Status tanggal dibedakan warna: hadir, setengah hari, izin, sakit, cuti, alpha.
- Ditambah ringkasan bulanan per karyawan dari summary absensi backend.
- Klik tanggal membuka modal untuk ubah status dan jam masuk/keluar.

**Acceptance criteria:**
- Absensi tampil kalender.
- Tanggal hari ini terlihat jelas.
- Tanggal berisi absensi punya indikator.
- Bisa pindah bulan/tahun.
- Klik tanggal menampilkan detail absensi.

### Sprint 4: Replikasi Flow Dompet ke Unit Lain

#### BGK-011 - Adaptasi flow dompet ke unit Jual Beli Mobil

**Prioritas:** Sedang

**Tipe:** UI/flow consistency

**Deskripsi:**
Flow dompet yang sudah dimatangkan di bengkel diterapkan ke unit bisnis Jual Beli Mobil dengan penyesuaian wallet, history, hutang/piutang, dan permission unit mobil.

**Task teknis:**
- Inventaris komponen dompet dan riwayat di menu Jual Beli Mobil.
- Adaptasi layout saldo, quick actions, dan history mengikuti flow bengkel final.
- Hubungkan CTA hutang/piutang ke halaman finance dengan filter unit mobil.
- Pastikan transfer/setoran hanya memakai wallet dan tujuan yang valid untuk unit mobil.
- Cek permission role unit mobil agar tetap scoped ke unit sendiri.
- Verifikasi dampak ke mutasi kas, saldo wallet, dan laporan.

**Acceptance criteria:**
- Menu dompet unit mobil mengikuti flow UX yang sama dengan bengkel.
- Hutang/piutang unit mobil bisa diakses lewat CTA terfilter.
- Role unit mobil tidak bisa melihat atau memproses data unit lain.
- Mutasi saldo dan riwayat tetap konsisten.

#### BGK-012 - Adaptasi flow dompet ke unit Jasa Angkut

**Prioritas:** Sedang

**Tipe:** UI/flow consistency

**Deskripsi:**
Flow dompet yang sudah dimatangkan di bengkel diterapkan ke unit bisnis Jasa Angkut dengan penyesuaian wallet, history, hutang/piutang, dan permission unit jasa angkut.

**Task teknis:**
- Inventaris komponen dompet dan riwayat di menu Jasa Angkut.
- Adaptasi layout saldo, quick actions, dan history mengikuti flow bengkel final.
- Hubungkan CTA hutang/piutang ke halaman finance dengan filter unit jasa angkut.
- Pastikan transfer/setoran hanya memakai wallet dan tujuan yang valid untuk unit jasa angkut.
- Cek permission role unit jasa angkut agar tetap scoped ke unit sendiri.
- Verifikasi dampak ke mutasi kas, saldo wallet, dan laporan.

**Acceptance criteria:**
- Menu dompet unit jasa angkut mengikuti flow UX yang sama dengan bengkel.
- Hutang/piutang unit jasa angkut bisa diakses lewat CTA terfilter.
- Role unit jasa angkut tidak bisa melihat atau memproses data unit lain.
- Mutasi saldo dan riwayat tetap konsisten.

## Yang Bisa Dieksekusi Dulu

### Eksekusi 1 - Permission admin bengkel ✅

`BGK-001` dan `BGK-002` sudah dieksekusi.

**Alasan:**
- Dampak langsung ke user.
- Risiko lebih kecil daripada edit transaksi.
- Biasanya hanya menyentuh permission, guard UI, dan endpoint yang sudah ada.
- Bisa dites cepat dengan login admin bengkel.

**Output awal yang diharapkan:**
- Admin bengkel bisa input kasbon/pinjaman.
- Admin bengkel bisa setor uang dompet.

### Eksekusi 2 - UI ringan tanpa ubah data besar ✅

`BGK-003` dan `BGK-004` sudah dieksekusi.

**Alasan:**
- Tidak banyak menyentuh logic keuangan.
- Bisa memperbaiki pengalaman pakai dengan cepat.
- Risiko data kecil.

**Output awal yang diharapkan:**
- Posisi riwayat dan kotak dompet sudah sesuai.
- Tombol kembali tidak lompat langsung ke awal.

### Eksekusi 3 - Edit transaksi dan integrasi hutang

`BGK-007` sudah berjalan untuk flow pembelian part.

Kerjakan klarifikasi `BGK-006` bila memang dibutuhkan modul pembelian service baru.

**Alasan:**
- Ini paling penting, tapi risiko paling besar.
- Edit transaksi menyentuh stok, saldo, hutang, dan laporan.
- Perlu audit sumber data supaya tidak muncul selisih atau dobel transaksi.

**Output awal yang diharapkan:**
- Pembelian hutang part otomatis masuk hutang piutang.
- Scope `BGK-006` jelas sebelum implementasi lanjutan.

### Eksekusi 4 - Sinkronisasi dan absensi ✅

`BGK-009` dan `BGK-010` sudah dieksekusi.

**Alasan:**
- Sinkron angka butuh tracing lintas halaman.
- Absensi kalender lebih banyak di UI, tapi tetap perlu pastikan data tanggal benar.

**Output awal yang diharapkan:**
- Angka master data sama dengan pusat.
- Absensi tampil kalender dengan tanda tanggal hari ini.

### Eksekusi 5 - Replikasi flow dompet lintas unit ← next

Kerjakan `BGK-011` dan `BGK-012` setelah `BGK-006`, `BGK-007`, `BGK-009`, `BGK-010`, dan testing flow dompet bengkel stabil.

**Alasan:**
- Bengkel jadi template awal agar implementasi lintas unit tidak pecah desain.
- Perlu jaga konsistensi UX tanpa merusak aturan ledger per unit.
- Replikasi lintas unit lebih aman setelah pola permission, mutasi, dan history di bengkel sudah stabil.

**Output awal yang diharapkan:**
- Unit Jual Beli Mobil memakai flow dompet yang konsisten dengan bengkel.
- Unit Jasa Angkut memakai flow dompet yang konsisten dengan bengkel.
- CTA hutang/piutang dan mutasi wallet tetap scoped per unit.

## Catatan Pengembangan Lanjutan

- Flow dan desain dompet yang sudah dimatangkan di menu bengkel akan direplikasi ke unit bisnis `Jual Beli Mobil` dan `Jasa Angkut`.
- Replikasi harus tetap mengikuti scope wallet/unit masing-masing agar tidak membuka akses silang antar unit.
- Implementasi lintas unit sebaiknya reuse pola UI dan aturan ledger yang sama, tapi tetap cek perbedaan alur bisnis tiap unit.

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
