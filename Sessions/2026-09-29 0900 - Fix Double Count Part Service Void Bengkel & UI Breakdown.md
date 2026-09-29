---
tags: [tpm, session]
date: 2026-09-29
time: "09:00"
module: keuangan
status: done
agent: claude-code
files: [backend/app/models/mobil.py, backend/app/schemas/mobil.py, frontend/components/MobilDetail.tsx, backend/requirements.txt]
---

Format: Markdown | Status: DONE | Scope: Backend & Frontend Fixes

⬅️ [[CLAUDE|Kembali ke Hub]] · [[TPM - Log Pengembangan|Index Sesi]]

## Goal

Perbaiki double-count sparepart/service pada detail mobil setelah transaksi bengkel di-void (BATAL). Tambah breakdown rincian biaya di UI.

## Diagnosis

**Bug:** `Mobil.total_part_service` di `models/mobil.py:179-182` menjumlah `bengkel_perbaikan.grand_total` tanpa filter `status_bayar != BATAL`. Transaksi bengkel yang sudah di-void tetap dihitung.

Bukti: Toyota Dump Dyna F 8441 GP (id=55) punya workshop id=64 (sudah BATAL). Sebelum fix:

| Item | Nilai (salah) | Nilai (benar) |
|---|---|---|
| Total Biaya & Sparepart | Rp6.880.000 | Rp1.000.000 |
| Estimasi Modal Unit | Rp111.880.000 | Rp106.000.000 |

## Perbaikan

### 1. Backend — `app/models/mobil.py:180`
Tambah `and t.status_bayar != PaymentStatus.BATAL` di filter `total_part_service`.

### 2. Backend — `app/schemas/mobil.py`
Tambah `MobilBiayaResponse` dan `MobilPartServiceResponse`. Kirim `biaya_lainnya` dan `part_services` di `MobilDetailResponse`.

### 3. Frontend — `components/MobilDetail.tsx`
Render breakdown di bawah Total Biaya & Sparepart:
- **Biaya Lainnya**: deskripsi, kategori, jumlah
- **Sparepart / Service**: deskripsi, tipe, qty, total

### 4. Backend — `requirements.txt`
Pin `websockets<14` untuk kompatibilitas Starlette 0.27.0.

## Verification

- `pytest`: 7/7 PASS
- `npx tsc --noEmit`: PASSED

## Commit

`1d3f3c25` — fix(mobil): filter BATAL transaksi di total_part_service + UI breakdown biaya