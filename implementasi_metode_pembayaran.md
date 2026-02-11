# Integrasi Transaksi Keuangan dengan KasBank

> **Status: SELESAI DIIMPLEMENTASIKAN**

## Ringkasan
Setiap transaksi keuangan (masuk/keluar) harus otomatis tercatat di tabel `kas_bank` sesuai metode pembayaran:
- **TUNAI** → masuk ke `CASH`
- **TRANSFER** → masuk ke `BANK_BCA` (default)

## Mapping PaymentMethod → KasBankJenis
```python
def get_kas_jenis_from_payment_method(metode: PaymentMethod) -> KasBankJenis:
    if metode == PaymentMethod.TRANSFER:
        return KasBankJenis.BANK_BCA
    return KasBankJenis.CASH  # TUNAI
```

## Perubahan yang Diperlukan

### 1. Helper Function (Buat File Baru)
**File:** `backend/app/services/kas_bank_integration.py`

Buat helper function untuk integrasi KasBank:
```python
def create_kas_bank_entry(
    db: Session,
    tanggal: date,
    tipe: KasBankType,  # MASUK/KELUAR
    nominal: Decimal,
    sumber: KasBankSource,
    metode_bayar: PaymentMethod,
    referensi_id: int,
    nomor_referensi: str,
    keterangan: str,
    user_id: Optional[int] = None,
) -> KasBank
```

### 2. Transaksi Bengkel (UANG MASUK)
**File:** `backend/app/services/transaksi_bengkel_service.py`

| Method | Kondisi | Aksi KasBank |
|--------|---------|--------------|
| `create()` | `jumlah_bayar > 0` | MASUK, sumber=BENGKEL |
| `update_payment()` | `jumlah_bayar > 0` | MASUK, sumber=BENGKEL |

### 3. Penjualan Mobil (UANG MASUK)
**File:** `backend/app/services/penjualan_mobil_service.py`

| Method | Kondisi | Aksi KasBank |
|--------|---------|--------------|
| `create()` | `dp > 0` | MASUK, sumber=JUAL_BELI_MOBIL |
| `update_payment()` | `jumlah_bayar > 0` | MASUK, sumber=JUAL_BELI_MOBIL |

### 4. Pembayaran Piutang (UANG MASUK)
**File:** `backend/app/services/piutang_service.py`

| Method | Kondisi | Aksi KasBank |
|--------|---------|--------------|
| `process_payment()` | selalu | MASUK, sumber=PIUTANG |

### 5. Kasbon Karyawan (UANG KELUAR)
**File:** `backend/app/services/kasbon_service.py`

| Method | Kondisi | Aksi KasBank |
|--------|---------|--------------|
| `create()` | selalu | KELUAR, sumber=KASBON |

**Catatan:** Perlu tambah parameter `metode_bayar` di `KasbonCreate` schema.

### 6. Slip Gaji (UANG KELUAR)
**File:** `backend/app/services/slip_gaji_service.py`

| Method | Kondisi | Aksi KasBank |
|--------|---------|--------------|
| `process_payment()` | selalu | KELUAR, sumber=GAJI |

### 7. Pengeluaran Bengkel (UANG KELUAR)
**File:** `backend/app/services/pengeluaran_service.py`

| Method | Kondisi | Aksi KasBank |
|--------|---------|--------------|
| `create()` | selalu | KELUAR, sumber=PENGELUARAN |

## File yang Perlu Dimodifikasi

1. **Baru:** `backend/app/services/kas_bank_integration.py` - Helper functions
2. **Edit:** `backend/app/services/transaksi_bengkel_service.py` - 2 methods (create, update_payment)
3. **Edit:** `backend/app/services/penjualan_mobil_service.py` - 2 methods (create, update_payment)
4. **Edit:** `backend/app/services/piutang_service.py` - 1 method (process_payment)
5. **Edit:** `backend/app/services/kasbon_service.py` - 1 method (create)
6. **Edit:** `backend/app/services/slip_gaji_service.py` - 1 method (process_payment)
7. **Edit:** `backend/app/services/pengeluaran_service.py` - 1 method (create)
8. **Edit:** `backend/app/schemas/karyawan.py` - Tambah `metode_bayar` di `KasbonCreate`

**Note:** `SlipGajiUpdate` sudah memiliki field `metode_bayar`, jadi tidak perlu diubah.

## Status Implementasi

| File | Status |
|------|--------|
| `backend/app/services/kas_bank_integration.py` | ✅ Dibuat |
| `backend/app/services/transaksi_bengkel_service.py` | ✅ Dimodifikasi |
| `backend/app/services/penjualan_mobil_service.py` | ✅ Dimodifikasi |
| `backend/app/services/piutang_service.py` | ✅ Dimodifikasi |
| `backend/app/services/kasbon_service.py` | ✅ Dimodifikasi |
| `backend/app/services/slip_gaji_service.py` | ✅ Dimodifikasi |
| `backend/app/services/pengeluaran_service.py` | ✅ Dimodifikasi |
| `backend/app/schemas/karyawan.py` | ✅ Dimodifikasi (tambah metode_bayar di KasbonCreate) |
| `backend/app/api/v1/transaksi_bengkel.py` | ✅ Dimodifikasi |
| `backend/app/api/v1/penjualan_mobil.py` | ✅ Dimodifikasi |
| `backend/app/api/v1/slip_gaji.py` | ✅ Dimodifikasi |

## Contoh Implementasi

### Helper Function (kas_bank_integration.py)
```python
from datetime import date
from decimal import Decimal
from typing import Optional
from sqlalchemy.orm import Session

from app.models.keuangan import KasBank
from app.schemas.keuangan import KasBankCreate
from app.services.kas_bank_service import KasBankService
from app.utils.constants import (
    KasBankType,
    KasBankSource,
    KasBankJenis,
    PaymentMethod,
)


def get_kas_jenis(metode_bayar: PaymentMethod) -> KasBankJenis:
    """Map payment method to kas/bank type."""
    if metode_bayar == PaymentMethod.TRANSFER:
        return KasBankJenis.BANK_BCA
    return KasBankJenis.CASH


def create_kas_entry(
    db: Session,
    tanggal: date,
    tipe: KasBankType,
    nominal: Decimal,
    sumber: KasBankSource,
    metode_bayar: PaymentMethod,
    referensi_id: Optional[int],
    nomor_referensi: str,
    keterangan: str,
    user_id: Optional[int] = None,
) -> KasBank:
    """Create kas/bank entry for financial transactions."""
    service = KasBankService(db)

    data = KasBankCreate(
        tanggal=tanggal,
        jenis=get_kas_jenis(metode_bayar),
        tipe=tipe,
        nominal=nominal,
        sumber=sumber,
        referensi_id=referensi_id,
        nomor_referensi=nomor_referensi,
        keterangan=keterangan,
    )

    return service.create(data, user_id)
```

### Contoh di transaksi_bengkel_service.py
```python
# Di method create(), setelah commit:
if data.jumlah_bayar > 0:
    create_kas_entry(
        db=self.db,
        tanggal=data.tanggal,
        tipe=KasBankType.MASUK,
        nominal=data.jumlah_bayar,
        sumber=KasBankSource.BENGKEL,
        metode_bayar=data.metode_bayar,
        referensi_id=transaksi.id,
        nomor_referensi=transaksi.nomor_transaksi,
        keterangan=f"Pembayaran transaksi bengkel {transaksi.nomor_transaksi}",
        user_id=user_id,
    )
```

## Verifikasi

1. **Test Transaksi Bengkel:**
   - Buat transaksi dengan pembayaran tunai → cek kas CASH bertambah
   - Buat transaksi dengan pembayaran transfer → cek kas BANK_BCA bertambah

2. **Test Penjualan Mobil:**
   - Buat transaksi dengan DP → cek kas bertambah sesuai metode bayar

3. **Test Pembayaran Piutang:**
   - Bayar piutang → cek kas bertambah

4. **Test Kasbon:**
   - Buat kasbon → cek kas berkurang

5. **Test Slip Gaji:**
   - Bayar gaji → cek kas berkurang

6. **Test Pengeluaran:**
   - Buat pengeluaran → cek kas berkurang

7. **Cek endpoint `/kas-bank/balances`** untuk memastikan saldo terupdate dengan benar.
