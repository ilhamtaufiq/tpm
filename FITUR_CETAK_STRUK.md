# Fitur Cetak Struk Thermal

Fitur cetak struk thermal telah ditambahkan ke aplikasi TPM Super App dengan dukungan printer thermal 80mm (default) dan 58mm.

## Komponen yang Ditambahkan

### 1. **Print Settings Service** (`frontend/utils/printSettings.ts`)
   - Mengelola pengaturan cetak dengan AsyncStorage
   - Konfigurasi yang dapat disimpan:
     - Nama usaha
     - Alamat
     - Nomor telepon
     - Logo usaha
     - Teks header
     - Teks footer
     - Ukuran kertas (80mm/58mm)

### 2. **Print Utility** (`frontend/utils/printReceipt.ts`)
   - Fungsi `printReceipt()` - Cetak struk langsung ke printer
   - Fungsi `saveReceiptPDF()` - Simpan struk sebagai PDF dan share
   - Generate HTML untuk format thermal printer
   - Support untuk web dan mobile (Expo Print API)

### 3. **Thermal Receipt Component** (`frontend/components/ui/ThermalReceipt.tsx`) 
   - Komponen React untuk render preview struk
   - Format thermal printer (80mm/58mm)
   - Support untuk transaksi Bengkel dan Jasa Angkut

### 4. **Settings Screen** (`frontend/app/settings/print.tsx`)
   - UI untuk konfigurasi pengaturan cetak
   - Upload logo usaha
   - Edit info perusahaan
   - Pilih ukuran kertas
   - Simpan dan reset pengaturan

## Integrasi

### Bengkel (`frontend/app/bengkel/index.tsx`)
- Tombol "Cetak Struk" pada detail transaksi yang sudah selesai
- Tombol "Simpan PDF" untuk export dan share
- Otomatis membaca pengaturan cetak
- Menampilkan:
  - Info usaha (nama, alamat, telepon)
  - Nomor transaksi
  - Data customer dan kendaraan
  - Rincian jasa dan sparepart
  - Total pembayaran
  - Metode pembayaran

### Profile (`frontend/app/(tabs)/profile.tsx`)
- Menu "Pengaturan Cetak Struk" ditambahkan
- Navigasi ke settings/print untuk konfigurasi

## Cara Penggunaan

### 1. **Konfigurasi Awal**
   1. Buka menu **Profile**
   2. Pilih **Pengaturan Cetak Struk**
   3. Isi informasi usaha:
      - Nama usaha
      - Alamat lengkap
      - Nomor telepon
   4. (Opsional) Upload logo usaha
   5. Sesuaikan teks header dan footer
   6. Pilih ukuran kertas sesuai printer (80mm atau 58mm)
   7. Klik **Simpan Pengaturan**

### 2. **Cetak Struk Bengkel**
   1. Buka transaksi bengkel yang sudah **SELESAI**
   2. Klik tombol **"Cetak Struk"** untuk langsung cetak
   3. Atau klik **"Simpan PDF"** untuk export dan share

### 3. **Format Struk**
   Struk akan menampilkan:
   - ✅ Logo usaha (jika diupload)
   - ✅ Nama usaha
   - ✅ Header custom
   - ✅ Alamat dan telepon
   - ✅ Nomor transaksi
   - ✅ Tanggal dan jam
   - ✅ Data customer
   - ✅ No. polisi & jenis kendaraan (Bengkel)
   - ✅ Rute dan supir (Jasa Angkut)
   - ✅ Rincian item dengan qty dan harga
   - ✅ Subtotal, pajak, diskon (jika ada)
   - ✅ **Total pembayaran**
   - ✅ Metode pembayaran
   - ✅ Uang dibayar & kembalian (jika tunai)
   - ✅ Catatan transaksi
   - ✅ Footer custom
   - ✅ Timestamp otomatis

## Teknologi yang Digunakan

- **expo-print**: Printing API untuk mobile dan web
- **expo-sharing**: Share PDF hasil export
- **expo-image-picker**: Upload logo usaha
- **@react-native-async-storage/async-storage**: Simpan pengaturan lokal

## Platform Support

- ✅ **Android**: Full support (cetak dan PDF)
- ✅ **iOS**: Full support (cetak dan PDF)
- ✅ **Web**: Print dialog browser

## Catatan

- Ukuran kertas default adalah **80mm** (standar thermal printer)
- Logo maksimal **1MB**
- Format logo yang didukung: JPG, PNG
- Rasio logo yang disarankan: **1:1** (persegi)
- Printer harus support ESC/POS atau thermal printing standard
- Pada web, akan membuka print dialog browser
- PDF dapat di-share via WhatsApp, Email, dll.

## Troubleshooting

### 1. **Struk tidak keluar**
   - Pastikan printer thermal terhubung dengan perangkat
   - Pastikan printer sudah ON dan ada kertas
   - Coba print dari aplikasi lain untuk test printer

### 2. **Layout struk tidak rapi**
   - Periksa ukuran kertas di pengaturan (80mm vs 58mm)
   - Pastikan sesuai dengan ukuran kertas printer

### 3. **Logo tidak muncul**
   - Cek ukuran file logo (maks 1MB)
   - Gunakan format JPG atau PNG
   - Upload ulang logo di pengaturan

### 4. **PDF tidak bisa di-share**
   - Pastikan aplikasi share (WhatsApp, Email) sudah terinstall
   - Berikan izin storage pada aplikasi TPM

## Rencana Pengembangan

- [ ] Support Bluetooth thermal printer
- [ ] Template struk custom
- [ ] Barcode/QR code pada struk
- [ ] Cetak ulang struk lama
- [ ] History cetak struk
- [ ] Multi-bahasa pada struk
- [ ] Preview struk sebelum cetak
