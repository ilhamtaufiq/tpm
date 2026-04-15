# PROPOSAL PENGEMBANGAN SISTEM INFORMASI ERP (JASA ANGKUT & BENGKEL)

**Tanggal:** 11 April 2026  
**Lokasi:** Cianjur, Jawa Barat  
**Nomor Surat:** 001/PROP-IT/IV/2026  
**Perihal:** Penawaran Jasa Pembuatan Aplikasi Web dan Mobile  

---

## I. Latar Belakang
Dalam rangka meningkatkan efisiensi operasional dan akurasi pencatatan data pada perusahaan, dibutuhkan sebuah sistem informasi terintegrasi (ERP) yang mampu mengelola berbagai aspek operasional, mulai dari manajemen armada, inventori bengkel, hingga pelaporan keuangan terpusat. Untuk memenuhi kebutuhan mobilitas di lapangan, sistem ini juga dilengkapi dengan aplikasi *mobile* berbasis Android/iOS untuk pelacakan *real-time* kegiatan driver dan mekanik.

## II. Ruang Lingkup Pekerjaan (Scope of Work)
Pekerjaan ini mencakup desain, pengembangan, pengujian, dan penerapan aplikasi (Web Dashboard, Mobile App, dan Backend RESTful API) dengan spesifikasi modul sebagai berikut:

**1. Modul Keuangan & Akuntansi (Core Finance)**
- Pencatatan multi-akun (Kas Unit, Kas Kecil, Bank Utama, dll)
- Rekonsiliasi transaksi Kas & Bank
- Pelaporan *real-time*: Neraca (Balance Sheet), Laba/Rugi (Income Statement), dan Laporan Perubahan Modal.

**2. Modul Jasa Angkut & Armada (Logistik)**
- Inventori dan riwayat kendaraan.
- Pencatatan Muatan (titik muat & bongkar).
- Pencatatan biaya operasional jalan multi-pembayaran (Cash/Transfer/Split).

**3. Modul Bengkel & Inventori (Workshop)**
- Manajemen stok suku cadang (Spareparts).
- Fitur Import massal Sparepart menggunakan Microsoft Excel.
- Alur pembelian barang ke supplier dan pencatatan nilai aset inventori.

**4. Aplikasi Mobile (Tracker & Operasional)**
- Autentikasi Pengguna (Login Khusus Driver / Karyawan).
- Perekaman kegiatan (*Activity Log*).
- Pelacakan lokasi *real-time* menggunakan sensor GPS terintegrasi Peta.

---

## III. Spesifikasi Teknologi
- **Backend / Database:** Python (FastAPI/SQLAlchemy), PostgreSQL / SQLite.
- **Web Frontend:** Next.js, React.js dengan design system *Glassmorphism* yang responsif.
- **Mobile Frontend:** React Native / Expo (Cross-platform Android & iOS).
- **Infrastruktur Cloud:** VPS Server, SSL Certificates, GPS Cloud integrations.

---

## IV. Rencana Anggaran Biaya (RAB)

Pekerjaan dikembangkan dalam durasi rata-rata **3.5 Bulan** dengan rincian biaya tim *dedicated* berikut:

| No | Deskripsi / Posisi Tim | Kuantitas (Bulan) | Harga Satuan (Rp) | Total Harga (Rp) |
|:---|:---|:---:|:---:|---:|
| 1. | **System Analyst / Project Manager**<br>*(Requirement, Arsitektur Database, Timeline)* | 3.5 | 7.000.000,- | 24.500.000,- |
| 2. | **Backend Developer**<br>*(API, Jurnal Akuntansi, Skema Database)* | 3.5 | 7.000.000,- | 24.500.000,- |
| 3. | **Web Frontend Developer**<br>*(Dashboard Admin, Reporting, UI)* | 3.5 | 6.000.000,- | 21.000.000,- |
| 4. | **Mobile App Developer**<br>*(Aplikasi Android/iOS, Konfigurasi GPS)* | 3.5 | 7.000.000,- | 24.500.000,- |
| 5. | **Software Quality & Tester (QA)**<br>*(Testing bugs, Rekonsiliasi UAT)* | 3.5 | 4.000.000,- | 14.000.000,- |
| 6. | **Infrastruktur Tahun Pertama**<br>*(Cloud VPS, Domain, Maps API, App Store Dev)* | 1 Paket | 7.500.000,- |  7.500.000,- |
| | | | **GRAND TOTAL** | **116.000.000,-** |

*Catatan: Harga di atas merupakan penyesuaian standard rate lokal dan bersifat negosiabel (dapat disesuaikan jika dilakukan rasionalisasi modul).*

---

## V. Rencana Waktu Pekerjaan (Timeline)
Total Estimasi Waktu: **14 Minggu** (~3.5 Bulan)

- **Minggu 1 - 2:** Requirements Gathering, UI/UX Design & Database Architecture.
- **Minggu 3 - 6:** Development Phase 1 (Backend API & Setup UI Dashboard Web).
- **Minggu 7 - 10:** Development Phase 2 (Mobile App Integration & Modul Sistem Akuntansi/Jurnal).
- **Minggu 11 - 12:** System Integration, IoT GPS Location & Laporan Keuangan Akhir.
- **Minggu 13 - 14:** UAT (User Acceptance Testing), Bug Fixing, Training, dan Deployment.

---

## VI. Termin Pembayaran (Payment Terms)
Pembayaran dilakukan secara bertahap sesuai pencapaian (*Milestone*):

1. **Termin I (DP - 30%) :** Sebesar **Rp 34.800.000,-** ditagihkan saat penandatanganan kontrak dan Kick-off Project.
2. **Termin II (Progress 50%) :** Sebesar **Rp 34.800.000,-** ditagihkan ketika Backend dan Web Dashboard utama (Modul Jasa Angkut & Bengkel) selesai dan siap didemokan.
3. **Termin III (Progress 80%) :** Sebesar **Rp 34.800.000,-** ditagihkan ketika Aplikasi Mobile selesai diuji coba bersama Modul Keuangan (Neraca & Laba Rugi).
4. **Termin IV (Pelunasan 10%) :** Sebesar **Rp 11.600.000,-** ditagihkan setelah Go-Live, masa UAT divalidasi, dan serah terima akun (termasuk *source code*).

---

## VII. Syarat dan Ketentuan (MOU / Garansi)
1. **Garansi Maintenance:** Pekerjaan ini dilengkapi masa retensi/garansi *bug fixing* secara cuma-cuma selama **3 (Tiga) Bulan** terhitung sejak dokumen Serah Terima Pekerjaan (BAST) ditandatangani. Garansi tidak berlaku untuk penambahan fitur baru (Change Request).
2. **Kepemilikan Kode:** Seluruh *Source Code* dan *Database* sepenuhnya akan menjadi hak milik perusahan klien setelah pelunasan dilakukan.
3. **Kerahasiaan Data:** Pihak pengembang sepakat untuk menjaga kerahasiaan data (NDA / Non-Disclosure Agreement) dari entri keuangan klien.
4. Segala *tools* tambahan diluar infrastruktur awal (misal: Notifikasi SMS berbayar, Integrasi Payment Gateway Bank/Midtrans) yang diatur terpisah, biayanya ditanggung klien secara terpisah.

---

**Menyetujui & Mengesahkan:**

<br><br><br>

___________________________<br>
**( PIHAK PERTAMA / KLIEN )**<br>
Direktur / Manager Operasional

<br><br><br>

___________________________<br>
**( PIHAK KEDUA / PENGEMBANG )**<br>
Project Manager IT Team
