# 📱 Flow QR Code pada Struk - TPM Super App

Dokumentasi lengkap tentang bagaimana QR Code bekerja pada sistem cetak struk.

---

## 🔄 ALUR LENGKAP QR CODE

```
┌─────────────────────────────────────────────────────────────────┐
│                    1. CETAK STRUK                               │
│  Transaksi Bengkel/Jasa Angkut → Generate QR Code → Print      │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    2. CUSTOMER SCAN QR                          │
│  Gunakan camera/QR scanner app → Detect QR code URL            │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    3. BUKA BROWSER                              │
│  https://tpm.app/receipt/bengkel/12345                          │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    4. TAMPIL STRUK DIGITAL                      │
│  • View full receipt details                                    │
│  • Download PDF                                                 │
│  • Share via WhatsApp/Email                                     │
│  • Verify transaction                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 FORMAT QR CODE

### Option 1: URL (RECOMMENDED) ⭐

**Format**:
```
https://tpm.app/receipt/{type}/{transaction_id}
```

**Examples**:
```
https://tpm.app/receipt/bengkel/123
https://tpm.app/receipt/jasa_angkut/456
```

**Ketika di-scan**:
1. 📱 Camera/QR scanner detect URL
2. 🌐 Auto-open browser
3. 📄 Tampilkan halaman receipt digital
4. ✅ Customer bisa view, download, share

### Option 2: Transaction Data

**Format**:
```
{TYPE}-{TRANSACTION_NUMBER}-{TOTAL}
```

**Examples**:
```
BENGKEL-12345-150000
JASA_ANGKUT-67890-500000
```

**Ketika di-scan**:
1. 📱 Scanner hanya tampilkan text
2. ❌ Tidak auto-open browser
3. ℹ️ Hanya untuk verifikasi manual

---

## 🌐 HALAMAN RECEIPT DIGITAL

### URL Structure
```
Frontend: /receipt/[type]/[id]
Backend:  /public/receipt/{type}/{id}
```

### Fitur Halaman

✅ **View Receipt** - Lihat struk lengkap
- Informasi perusahaan
- Detail customer
- Rincian item
- Total pembayaran
- Metode bayar
- Catatan

✅ **Download PDF** - Download sebagai PDF
- Generate PDF dari transaction
- Auto-download ke device

✅ **Share Receipt** - Bagikan struk
- WhatsApp
- Email
- Social media
- Copy link

✅ **Transaction Verification** - Verifikasi transaksi
- Confirm transaction number
- Check amount
- Validate date

---

## 🔧 IMPLEMENTASI TEKNIS

### Frontend Route
```
File: frontend/app/receipt/[type]/[id].tsx
Route: /receipt/{type}/{id}
```

**Features**:
- Dynamic routing dengan params
- Fetch data dari backend
- Responsive design
- Loading & error states
- Share functionality

### Backend Endpoint
```
File: backend/app/api/v1/endpoints/public_receipt.py
Endpoint: GET /public/receipt/{type}/{id}
```

**Features**:
- Public access (no auth required)
- Support bengkel & jasa_angkut
- Return formatted receipt data
- Error handling

### Service Layer
```
File: frontend/services/printReceiptService.ts
```

**Methods**:
```typescript
// Get receipt data
getReceipt(type, id): Promise<Receipt>

// Get PDF URL
getReceiptPDFUrl(type, id): string

// Get share URL
getReceiptShareUrl(type, id): string
```

---

## 🎨 CONTOH SCREEN FLOW

### 1. **Print Struk (dengan QR)**
```
┌────────────────────────────┐
│   TPM BUSINESS             │
│   Jl. Contoh No. 123       │
│   (021) 1234-5678          │
│                            │
│ ════════════════════════   │
│ No: 12345                  │
│ Tgl: 06/02/2026            │
│ Customer: John Doe         │
│ No. Polisi: B1234XYZ       │
│ ════════════════════════   │
│                            │
│ Service A      Rp 100,000  │
│ Part B x2      Rp  50,000  │
│                            │
│ ────────────────────────   │
│ TOTAL       Rp 150,000     │
│ ════════════════════════   │
│                            │
│     ┌─────────────┐        │  ← QR CODE
│     │  ▓▓░░▓▓░░  │        │
│     │  ░░▓▓░░▓▓  │        │
│     │  ▓▓░░▓▓░░  │        │
│     └─────────────┘        │
│                            │
│ Terima kasih!              │
└────────────────────────────┘
```

### 2. **Customer Scan QR**
```
📱 [Camera App]

    ┌─────────────────┐
    │                 │
    │   📷 CAMERA     │
    │                 │
    │  ┌───────────┐  │
    │  │ QR Code   │  │  ← Detect
    │  │ █▓░█▓░█▓  │  │
    │  │ ░█▓░█▓░█  │  │
    │  └───────────┘  │
    │                 │
    │  Open in        │
    │  ┌──────────┐   │
    │  │  Browser │   │  ← Tap
    │  └──────────┘   │
    └─────────────────┘
```

### 3. **Struk Digital Terbuka**
```
🌐 [Browser: tpm.app/receipt/bengkel/12345]

┌──────────────────────────────┐
│  ←  Struk Digital        ⋮   │
│  Bengkel • 12345             │
├──────────────────────────────┤
│                              │
│  ┌──────────────────────┐   │
│  │   ✅ Transaksi       │   │
│  │      Berhasil         │   │
│  │  06 Feb 2026, 08:00  │   │
│  └──────────────────────┘   │
│                              │
│  TPM BUSINESS                │
│  Jl. Contoh No. 123          │
│  (021) 1234-5678             │
│                              │
│  ╔═══════════════════════╗  │
│  ║ Customer: John Doe    ║  │
│  ║ No. Polisi: B1234XYZ  ║  │
│  ║ Kendaraan: Motor      ║  │
│  ╚═══════════════════════╝  │
│                              │
│  RINCIAN                     │
│  Service A     Rp 100,000   │
│  Part B x2     Rp  50,000   │
│  ─────────────────────────  │
│  TOTAL       Rp 150,000     │
│                              │
│  [Download PDF]              │
│  [Bagikan Struk]             │
└──────────────────────────────┘
```

---

## 💡 USE CASES

### 1. **Customer Verification**
Customer ingin verifikasi transaksi:
- Scan QR code
- Lihat detail lengkap
- Compare dengan struk fisik
- ✅ Confirm authenticity

### 2. **Digital Backup**
Customer ingin simpan struk digital:
- Scan QR code
- Download PDF
- Save to Google Drive/iCloud
- ✅ Backup tersimpan

### 3. **Share for Reimbursement**
Customer ingin claim dari perusahaan:
- Scan QR code
- Share via email ke finance
- ✅ Instant submission

### 4. **Lost Receipt**
Customer kehilangan struk fisik:
- Contact support dengan nomor transaksi
- Support send QR code via WhatsApp
- Customer scan & download ulang
- ✅ Receipt recovered

---

## ⚙️ KONFIGURASI

### Update Print Settings
```typescript
// frontend/utils/printSettings.ts

{
    showQRCode: true,  // Enable QR code
    qrCodeBaseURL: 'https://tpm.app',  // Your domain
    template: 'detailed'  // Use template that supports QR
}
```

### Generate QR Code
```typescript
import { generateReceiptURL } from './components/ui/ReceiptQRCode';

// Generate URL for QR
const qrURL = generateReceiptURL(
    'https://tpm.app',  // base URL
    '12345',            // transaction number
    'bengkel'           // type
);
// Result: "https://tpm.app/receipt/bengkel/12345"
```

### Render QR in Receipt
```typescript
import { ReceiptQRCode } from './components/ui/ReceiptQRCode';

// In receipt template
{template.features.showQRCode && (
    <ReceiptQRCode 
        value={qrURL} 
        size={80} 
    />
)}
```

---

## 🔐 SECURITY CONSIDERATIONS

### Public Access
✅ Receipt endpoint is **public** (no auth required)
- Allows anyone with QR to view receipt
- Good for customer convenience
- Consider adding validation:
  ```python
  # Optional: Add expiry
  if transaction.created_at < 90_days_ago:
      raise HTTPException(404, "Receipt expired")
  ```

### Private Mode (Future)
🔄 Optional: Add token-based access
```
URL: https://tpm.app/receipt/bengkel/12345?token=abc123
```
- Generate unique token per transaction
- Validate token before showing receipt
- ✅ More secure

---

## 🚀 DEPLOYMENT CHECKLIST

### Frontend
- [ ] Deploy to production (e.g., Vercel, Netlify)
- [ ] Get domain: `https://tpm.app`
- [ ] Configure routes untuk `/receipt/[type]/[id]`
- [ ] Test QR code scanning

### Backend
- [ ] Deploy API to production
- [ ] Expose `/public/receipt/*` endpoint
- [ ] Configure CORS untuk allow public access
- [ ] Add monitoring/analytics

### DNS
- [ ] Point `tpm.app` to frontend
- [ ] Configure `api.tpm.app` for backend (optional)
- [ ] SSL certificate (HTTPS)

### Testing
- [ ] Generate test transaction
- [ ] Print receipt dengan QR
- [ ] Scan QR code
- [ ] Verify struk digital muncul
- [ ] Test share & download

---

## 📱 CARA TEST

### 1. Local Testing
```bash
# Frontend
cd frontend
npm run web

# Backend
cd backend
python -m uvicorn app.main:app --reload

# URLs
Frontend: http://localhost:8081
Backend:  http://localhost:8000
Receipt:  http://localhost:8081/receipt/bengkel/123
```

### 2. Generate Test QR
```typescript
// Test: Generate QR dengan localhost
const testURL = 'http://localhost:8081/receipt/bengkel/123';

<ReceiptQRCode value={testURL} size={100} />
```

### 3. Scan dengan Phone
- Buka camera di phone
- Scan QR code di screen laptop
- Should open localhost URL (if same network)
- Or use ngrok untuk public URL

### 4. Production Test
```
1. Deploy frontend & backend
2. Update qrCodeBaseURL di settings
3. Create test transaction
4. Print receipt
5. Scan QR
6. ✅ Verify works!
```

---

## ❓ FAQ

### Q: Apakah QR code akan expired?
A: Saat ini tidak. Receipt bisa diakses selama data ada di database.

### Q: Bagaimana jika transaction dihapus?
A: QR code akan return 404 "Receipt not found"

### Q: Apakah bisa custom QR design?
A: Ya! Edit di `ReceiptQRCode.tsx`:
```typescript
<QRCode
    value={value}
    size={size}
    logo={require('./logo.png')}  // Add logo
    logoSize={30}
    logoBackgroundColor="white"
/>
```

### Q: Support Barcode juga?
A: Planned! Coming soon dengan library `react-native-barcode-svg`

---

## 🎯 NEXT STEPS

1. ✅ Setup backend endpoint
2. ✅ Create frontend page
3. ✅ Integrate QR code
4. ⏳ Deploy to production
5. ⏳ Test end-to-end
6. ⏳ Add analytics (track scans)

---

**Kesimpulan**: QR Code pada struk memungkinkan customer untuk mengakses struk digital secara online, download PDF, dan share dengan mudah. Flow-nya sederhana: Print → Scan → View → Download/Share! 🎉
