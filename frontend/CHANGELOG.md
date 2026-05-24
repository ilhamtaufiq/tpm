# Changelog Frontend (FE) - TPM ERP

Dokumen ini mencatat riwayat perubahan desain dan perbaikan *bug* pada sisi Frontend (Mobile/Web).

## [Unreleased] - Jual Beli Mobil Redesign & Fixes

### 🚀 Fitur & Desain Baru (Halaman Jual Beli Mobil)
- **Master Navigation Bar**: Mengimplementasikan *bottom tab bar* kustom dengan 5 slot menu utama (Home, Bengkel, FAB Plus, Angkut, Mobil) yang menggantikan navigasi *default*.
- **Header & Pencarian Terpusat**: Merombak area atas halaman mobil menjadi lebih bersih. Kotak pencarian kini sejajar dengan filter, dan tombol pintasan "Dompet" telah disematkan secara elegan di sebelah kanan pencarian.
- **Card Horizontal Layout**: Mengubah desain daftar mobil dari bentuk kotak/grid (Bento) menjadi bentuk *horizontal list* (40% foto di kiri, 60% teks informasi di kanan).
- **Badge Kaca (Glassmorphism)**: Menambahkan *overlay* modern di atas foto kendaraan pada *Card list* untuk menampilkan status Lunas/Hutang, nomor plat, serta tahun kendaraan.
- **Aksi Ringkas (Quick Actions)**: Memindahkan tombol aksi seperti "Service" (icon Dompet), "Jual" (icon Keranjang), dan "Hapus" ke bagian bawah masing-masing detail kartu mobil agar lebih intuitif.
- **Pembersihan UI Lama**: Menghilangkan komponen *Bento Grid* statistik (Laporan/Database) pada bagian atas halaman agar ruang tampilan lebih luas dan terfokus ke daftar inventaris mobil.

### 🛠️ Perbaikan Bug (Bug Fixes)
- **Modal Detail Web Tumpang Tindih**: Memperbaiki masalah di platform Web di mana *drag handle* dan lengkungan putih dari komponen Modal standar bawaan Expo bertabrakan dengan desain custom header `MobilDetail`. Kini Modal web dirender secara *fullscreen* penuh.
- **BottomSheet Native Terpotong**: Mengubah tinggi/snap point untuk Modal Detail Mobil di platform Native (Android/iOS) menjadi `100%` (*Full Screen*), menggantikan pengaturan sebelumnya yang hanya `95%`.
- **Z-Index FAB Utama**: Memperbaiki tata letak *Floating Action Button* "Tambah Mobil" di halaman daftar yang sebelumnya menghilang atau bertabrakan. Posisinya kini menggunakan *absolute inline style* (`bottom: 100`) dengan standar `elevation: 5` agar dipastikan muncul tanpa menghalangi *overlay bottom sheet*.
- **Posisi FAB dalam Modal Detail**: Memperbaiki posisi aksi unggah gambar, tombol bagikan, tombol hapus gambar, dan *pagination dots* di dalam galeri pratinjau `MobilDetail`. Sebelumnya, *spacing class* bawaan gagal di-*compile* oleh NativeWind (jatuh ke posisi `top: 0`), sehingga tombol bertabrakan dengan tombol `X`. Kini semuanya menggunakan standar letak *inline* statis `bottom: 64`.

---
*Catatan: Dokumen ini akan terus diperbarui secara berkala mengiringi implementasi desain baru di modul-modul lain (seperti Bengkel).*
