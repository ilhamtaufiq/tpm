# Fitur Enhancement Cetak Struk - TPM Super App

Dokumentasi untuk fitur-fitur tambahan pada sistem cetak struk thermal.

---

## 📋 1. PREVIEW STRUK SEBELUM CETAK

### Deskripsi
Fitur untuk melihat preview struk sebelum mencetak ke printer, dengan kontrol zoom dan opsi print/save.

### Komponen
- **File**: `frontend/components/ui/ReceiptPreview.tsx`
- **Props**:
  - `visible`: boolean - menampilkan/sembunyikan modal
  - `onClose`: () => void - callback saat tutup
  - `onPrint`: () => void - callback cetak
  - `onSavePDF`: () => void - callback simpan PDF
  - `data`: PrintReceiptData - data transaksi
  - `settings`: PrintSettings - pengaturan cetak
  - `loading`: boolean - status loading

### Fitur
✅ **Zoom Control**: Zoom in/out 50% - 200%
✅ **Real-time Preview**: Preview akurat sesuai ukuran kertas
✅ **Action Buttons**: Cetak langsung atau simpan PDF dari preview
✅ **Responsive**: Auto-scale untuk berbagai ukuran layar

### Cara Penggunaan

```typescript
import { ReceiptPreview } from './components/ui/ReceiptPreview';

const [showPreview, setShowPreview] = useState(false);

<ReceiptPreview
    visible={showPreview}
    onClose={() => setShowPreview(false)}
    onPrint={() => {
        setShowPreview(false);
        handlePrintReceipt(transaction);
    }}
    onSavePDF={() => {
        setShowPreview(false);
        handleSavePDF(transaction);
    }}
    data={receiptData}
   settings={printSettings}
    loading={printing}
/>
```

### Contoh Integrasi di Bengkel

```typescript
// Tambahkan state
const [showPreview, setShowPreview] = useState(false);
const [previewData, setPreviewData] = useState<any>(null);

// Fungsi show preview
const handleShowPreview = (item: any) => {
    setPreviewData(item);
    setShowPreview(true);
};

// Ganti tombol "Cetak Struk" dengan "Preview Struk"
<Button
    variant="outline"
    title="Preview Struk"
    onPress={() => handleShowPreview(selectedItem)}
    icon={<Eye size={20} color="#00AA13" />}
    className="rounded-2xl h-14"
/>
```

---

## 🔲 2. BARCODE / QR CODE PADA STRUK

### Deskripsi
Menambahkan QR Code pada struk untuk verifikasi transaksi atau link ke portal online.

### Komponen
- **File**: `frontend/components/ui/ReceiptQRCode.tsx`
- **Dependencies**: `react-native-qrcode-svg`

### Instalasi
```bash
npm install react-native-qrcode-svg
```

### Fitur
✅ **QR Code Generation**: Generate QR dari nomor transaksi
✅ **Customizable Size**: Ukuran QR code dapat disesuaikan
✅ **Transaction Data**: Encode type, nomor, dan total transaksi
✅ **URL Support**: Generate link ke web portal

### Format Data QR Code

**Format 1: Transaction Data**
```
BENGKEL-12345-150000
[TYPE]-[TRANSACTION_NUMBER]-[TOTAL_AMOUNT]
```

**Format 2: Receipt URL**
```
https://tpm.app/receipt/bengkel/12345
[BASE_URL]/receipt/[TYPE]/[TRANSACTION_NUMBER]
```

### Helper Functions

```typescript
import { generateTransactionQRData, generateReceiptURL } from './utils/qr';

// Generate QR data
const qrData = generateTransactionQRData('12345', 'bengkel', 150000);
// Output: "BENGKEL-12345-150000"

// Generate URL
const qrURL = generateReceiptURL('https://tpm.app', '12345', 'bengkel');
// Output: "https://tpm.app/receipt/bengkel/12345"
```

### Penggunaan di Struk

QR Code akan otomatis ditampilkan jika:
1. Setting `showQRCode` = true
2. Template support QR (detailed, premium)

### Konfigurasi
Di pengaturan cetak (`PrintSettings`):
```typescript
{
    showQRCode: true,  // Tampilkan QR code
    qrCodeBaseURL: 'https://tpm.app'  // Base URL untuk generate link
}
```

---

## 📄 3. TEMPLATE STRUK

### Deskripsi
Sistem template yang memungkinkan pemilihan style struk sesuai kebutuhan.

### File
- **Template Config**: `frontend/utils/receiptTemplates.ts`
- **Template Types**: 4 template tersedia

### Template Yang Tersedia

#### 1. **SIMPLE** (Simpel)
- ❌ Logo
- ❌ QR Code
- ❌ Detail item (qty x harga)
- ❌ Catatan
- ❌ Uang dibayar/kembalian
- ❌ Info perusahaan lengkap
- 📏 Font: **Small**
- 📐 Spacing: **Compact**
- 🎯 **Use case**: Struk cepat, hemat kertas

#### 2. **STANDARD** (Standard) - DEFAULT
- ✅ Logo
- ❌ QR Code
- ✅ Detail item (qty x harga)
- ✅ Catatan
- ✅ Uang dibayar/kembalian
- ✅ Info perusahaan lengkap
- 📏 Font: **Medium**
- 📐 Spacing: **Normal**
- 🎯 **Use case**: Kebutuhan umum

#### 3. **DETAILED** (Lengkap)
- ✅ Logo
- ✅ QR Code
- ✅ Detail item (qty x harga)
- ✅ Catatan
- ✅ Uang dibayar/kembalian
- ✅ Info perusahaan lengkap
- 📏 Font: **Medium**
- 📐 Spacing: **Normal**
- 🎯 **Use case**: Transaksi lengkap dengan QR

#### 4. **PREMIUM** (Premium)
- ✅ Logo
- ✅ QR Code
- ✅ Detail item (qty x harga)
- ✅ Catatan
- ✅ Uang dibayar/kembalian
- ✅ Info perusahaan lengkap
- 📏 Font: **Large**
- 📐 Spacing: **Spacious**
- 🎯 **Use case**: Presentasi premium, mudah dibaca

### Konfigurasi Template

```typescript
import { RECEIPT_TEMPLATES } from './utils/receiptTemplates';

// Get template
const template = RECEIPT_TEMPLATES['standard'];

// Check features
if (template.features.showLogo) {
    // Render logo
}

if (template.features.showQRCode) {
    // Render QR code
}

// Get font sizes
const fontSize = TEMPLATE_FONT_SIZES[template.features.fontSize];
// { company: 16, header: 12, info: 10, ... }

// Get spacing
const spacing = TEMPLATE_SPACING[template.features.spacing];
// { section: 6, item: 4, divider: 8 }
```

### Setting Template di UI

Tambahkan di `settings/print.tsx`:

```typescript
<Card className="p-6 mb-6 rounded-[24px]">
    <Typography variant="h4" weight="bold" className="mb-4">
        Template Struk
    </Typography>
    
    <Tabs
        items={[
            { label: 'Simpel', value: 'simple' },
            { label: 'Standard', value: 'standard' },
            { label: 'Lengkap', value: 'detailed' },
            { label: 'Premium', value: 'premium' }
        ]}
        value={settings.template}
        onChange={(value) => setSettings({ ...settings, template: value as ReceiptTemplate })}
    />
    
    <View className="mt-4 p-4 bg-gray-50 rounded-2xl">
        <Typography variant="caption" className="text-gray-700">
            {RECEIPT_TEMPLATES[settings.template].description}
        </Typography>
    </View>
</Card>
```

---

## 📶 4. BLUETOOTH PRINTER SUPPORT

### Status
⚠️ **COMING SOON** - Dalam pengembangan

### Library yang Akan Digunakan
- `react-native-bluetooth-escpos-printer`
- `react-native-bluetooth-classic`

### Rencana Fitur
- ✅ Scan Bluetooth printer nearby
- ✅ Pair dengan printer
- ✅ Simpan printer favorit
- ✅ Auto-connect ke printer tersimpan
- ✅ Print via Bluetooth
- ✅ Fallback ke USB/network jika BT gagal

### Instalasi (Future)
```bash
npm install react-native-bluetooth-escpos-printer
npm install react-native-bluetooth-classic
```

### Setup Android Permissions
```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
```

### Contoh Flow
```typescript
// 1. Scan printers
const printers = await BluetoothManager.enableBluetooth();

// 2. Connect
await BluetoothEscposPrinter.connect(printerAddress);

// 3. Print
await BluetoothEscposPrinter.printText(receiptText, {});

// 4. Disconnect
await BluetoothEscposPrinter.closeConn();
```

---

## 🎨 PERBANDINGAN TEMPLATE

| Fitur | Simple | Standard | Detailed | Premium |
|-------|--------|----------|----------|---------|
| **Logo** | ❌ | ✅ | ✅ | ✅ |
| **QR Code** | ❌ | ❌ | ✅ | ✅ |
| **Detail Item** | ❌ | ✅ | ✅ | ✅ |
| **Catatan** | ❌ | ✅ | ✅ | ✅ |
| **Bayar/Kembalian** | ❌ | ✅ | ✅ | ✅ |
| **Info Perusahaan** | ❌ | ✅ | ✅ | ✅ |
| **Font Size** | Small | Medium | Medium | Large |
| **Spacing** | Compact | Normal | Normal | Spacious |
| **Estimasi Panjang** | ~8cm | ~12cm | ~15cm | ~18cm |
| **Hemat Kertas** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐ |
| **Profesional** | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 🚀 ROADMAP PENGEMBANGAN

### Phase 1: DONE ✅
- [x] Preview struk
- [x] QR Code support
- [x] Sistem template (4 template)
- [x] Dokumentasi lengkap

### Phase 2: IN PROGRESS 🔄
- [ ] Bluetooth printer support
- [ ] Template customization UI
- [ ] Print history log
- [ ] Reprint last receipt

### Phase 3: PLANNED 📋
- [ ] Custom template builder
- [ ] Multi-bahasa (EN/ID)
- [ ] Email receipt otomatis
- [ ] WhatsApp share receipt
- [ ] Cloud backup receipts
- [ ] Analytics dashboard (struk tercetak)

---

## 📱 CARA PENGGUNAAN LENGKAP

### 1. Setup Awal
```typescript
// 1. Buka Profile → Pengaturan Cetak Struk
// 2. Pilih template (Simple/Standard/Detailed/Premium)
// 3. Aktifkan QR Code jika perlu
// 4. Set base URL untuk QR (optional)
// 5. Simpan pengaturan
```

### 2. Preview & Cetak
```typescript
// 1. Buka transaksi yang sudah selesai
// 2. Klik "Preview Struk" untuk melihat
// 3. Zoom in/out untuk detail
// 4. Klik "Cetak Struk" atau "Simpan PDF"
```

### 3. Scan QR Code
```typescript
// Customer dapat scan QR code untuk:
// - Verifikasi nomor transaksi
// - Akses struk digital online
// - Download PDF receipt
// - Lihat detail transaksi
```

---

## ⚙️ KONFIGURASI LANJUTAN

### Update Print Settings Programmatically

```typescript
import { printSettingsService } from './utils/printSettings';

// Update template
await printSettingsService.saveSettings({
    template: 'premium'
});

// Enable QR code
await printSettingsService.saveSettings({
    showQRCode: true,
    qrCodeBaseURL: 'https://yourdomain.com'
});
```

### Custom QR Data Format

```typescript
// Override default QR data
const customQRData = JSON.stringify({
    txn: data.transactionNumber,
    type: data.type,
    amount: data.total,
    date: data.date.toISOString(),
    customer: data.customerName,
    // Custom fields
    branch: 'Jakarta Pusat',
    cashier: 'Admin 1'
});

<ReceiptQRCode value={customQRData} size={100} />
```

---

## 🐛 TROUBLESHOOTING

### QR Code tidak muncul
1. Pastikan `showQRCode: true` di settings
2. Pastikan template support QR (detailed/premium)
3. Check npm package `react-native-qrcode-svg` terinstall
4. Clear cache: `npx expo start --clear`

### Preview tidak akurat
1. Pastikan font dan spacing sesuai template
2. Check zoom level (100% = actual size)
3. Test print untuk verifikasi

### Template tidak berubah
1. Pastikan save settings berhasil
2. Reload print settings: `loadPrintSettings()`
3. Check AsyncStorage: `@print_settings`

---

## 📞 SUPPORT

Untuk bantuan lebih lanjut:
- 📖 Baca dokumentasi lengkap di `FITUR_CETAK_STRUK.md`
- 🔧 Check kode di `frontend/components/ui/ReceiptPreview.tsx`
- 📱 Test di device actual untuk best result
