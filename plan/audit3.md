# Audit 3 - Blueprint Implementasi Hardening Finansial dan Operasional TPM

Tanggal audit: 2026-06-05

Lanjutan dari:

- `plan/audit1.md`
- `plan/audit2.md`

Tujuan dokumen ini adalah mengubah audit risiko menjadi rancangan implementasi teknis yang bisa dikerjakan bertahap. Fokusnya bukan menambah fitur baru, tetapi membuat transaksi, laporan, dan UI lebih tahan terhadap bug data.

## Prinsip Implementasi

1. Jangan ubah seluruh sistem sekaligus.
2. Tambahkan guardrail dan test dulu sebelum refactor besar.
3. Backend menjadi sumber kebenaran final untuk status dan finance.
4. Ledger finansial harus bisa direversal, bukan dihapus.
5. UI harus menjelaskan konsekuensi aksi user.
6. Laporan harus dapat ditelusuri sampai transaksi asal.

## Target Arsitektur

### Lapisan Domain

Pisahkan tanggung jawab service:

```text
Operational Service
+-- membuat/mengubah data kerja
+-- tidak langsung membuat efek finansial final

Settlement Service
+-- membuat invoice/piutang/kas/hutang
+-- memproses pembayaran
+-- membuat reversal
+-- idempotent

Report Service
+-- hanya membaca data posted/final
+-- melakukan eliminasi internal
+-- menyediakan reconciliation details
```

### Service yang Disarankan

```text
backend/app/services/settlements/
+-- workshop_settlement_service.py
+-- car_sale_settlement_service.py
+-- transport_settlement_service.py
+-- receivable_settlement_service.py
+-- payable_settlement_service.py
+-- ledger_reversal_service.py
+-- reconciliation_service.py
```

Fungsi minimal setiap settlement service:

- `finalize(...)`
- `pay(...)`
- `void(...)`
- `reverse(...)`
- `reconcile(...)`

## State Machine

### Bengkel

Pisahkan status kerja dan status tagihan.

Status kerja:

```text
ANTRE -> PROSES -> SELESAI
ANTRE -> BATAL
PROSES -> BATAL
SELESAI -> BATAL only via void/reversal
```

Status tagihan:

```text
DRAFT
UNBILLED
INVOICED
PARTIAL
PAID
VOID
```

Mapping awal dari data existing:

| Existing | Target |
| --- | --- |
| `status_pengerjaan=ANTRE`, `grand_total=0` | kerja `ANTRE`, tagihan `DRAFT` |
| `status_pengerjaan=ANTRE/PROSES`, `grand_total>0` | kerja existing, tagihan `UNBILLED` |
| `status_pengerjaan=SELESAI`, `status_bayar=BELUM_LUNAS` | kerja `SELESAI`, tagihan `INVOICED` |
| `status_pengerjaan=SELESAI`, `status_bayar=CICILAN` | kerja `SELESAI`, tagihan `PARTIAL` |
| `status_pengerjaan=SELESAI`, `status_bayar=LUNAS` | kerja `SELESAI`, tagihan `PAID` |
| `status_bayar=BATAL` atau `status_pengerjaan=BATAL` | tagihan `VOID` |

Aturan:

- `ANTRE/PROSES` tidak boleh posted finance.
- `SELESAI + INVOICED/PARTIAL/PAID` boleh masuk laporan sesuai accrual/cash rule.
- Perubahan dari `PAID` ke status lain harus reversal.

### Jual Beli Mobil

Status unit:

```text
TERSEDIA -> BOOKING -> TERJUAL
TERSEDIA -> TERJUAL
BOOKING -> TERSEDIA via cancel booking
TERJUAL -> TERSEDIA only via cancel sale + reversal
```

Status settlement penjualan:

```text
DRAFT
BOOKED
PARTIAL
PAID
VOID
```

Status investor:

```text
NONE
PENDING
DISBURSED
REVERSED
```

Aturan:

- `TERJUAL` harus punya settlement `PAID` atau rule khusus cicilan yang jelas.
- Cancel sale investor `DISBURSED` wajib ditolak sampai reversal investor.
- Biaya internal bengkel pada mobil harus punya source reference dan klasifikasi HPP/internal.

### Jasa Angkut

Status kerja:

```text
PROSES -> SELESAI
PROSES -> BATAL
SELESAI -> BATAL only via void/reversal
```

Status tagihan:

```text
UNBILLED
INVOICED
PARTIAL
PAID
VOID
```

Keputusan bisnis yang wajib ditetapkan:

- Piutang JA memakai basis apa?
  - `harga_jual`
  - `pendapatan_kotor`
  - `share_tpm`

Rekomendasi teknis:

- Untuk invoice customer eksternal, gunakan `harga_jual`.
- Jika bisnis hanya mengakui margin TPM, simpan tetap di field terpisah dan jangan ambigu di piutang.

## Desain Ledger Reversal

### Kolom yang Disarankan

Tambahkan ke `kas_bank`:

```text
is_reversal BOOLEAN DEFAULT FALSE
reversal_of_id INT NULL
void_reason TEXT NULL
voided_by INT NULL
voided_at DATETIME NULL
source_type VARCHAR(80) NULL
source_id INT NULL
idempotency_key VARCHAR(120) NULL
```

Tambahkan ke pembayaran piutang/hutang jika belum ada:

```text
is_reversal BOOLEAN DEFAULT FALSE
reversal_of_id INT NULL
void_reason TEXT NULL
voided_by INT NULL
voided_at DATETIME NULL
idempotency_key VARCHAR(120) NULL
```

Tambahkan ke transaksi utama jika belum tersedia:

```text
posted_at DATETIME NULL
posted_by INT NULL
void_reason TEXT NULL
voided_by INT NULL
voided_at DATETIME NULL
last_finance_check_at DATETIME NULL
finance_status VARCHAR(40) NULL
```

### Pola Reversal Kas

Jika entry asli:

```text
MASUK 100000 KAS_UNIT_BENGKEL
```

Reversal:

```text
KELUAR 100000 KAS_UNIT_BENGKEL
is_reversal = true
reversal_of_id = entry_asli_id
```

Jika entry asli:

```text
KELUAR 50000 KAS_UNIT_MOBIL
```

Reversal:

```text
MASUK 50000 KAS_UNIT_MOBIL
is_reversal = true
reversal_of_id = entry_asli_id
```

Aturan:

- Entry asli tidak dihapus.
- Reversal hanya boleh dibuat sekali per entry.
- Laporan dapat menghitung net effect dengan menjumlah semua entry, atau exclude pair jika menampilkan history aktif.

## Idempotency

Payment dan settlement rawan duplicate karena double tap, retry jaringan, atau timeout.

Tambahkan `idempotency_key` untuk endpoint:

- bayar bengkel
- bayar piutang
- bayar hutang
- bayar mobil
- bayar muatan
- pencairan investor
- reversal/void

Rule:

- Jika request dengan key sama sudah sukses, return result yang sama.
- Jika request sama masih processing, return 409 atau status processing.
- Jika payload berbeda dengan key sama, reject.

Contoh header:

```text
Idempotency-Key: workshop-payment-TRX123-20260605-001
```

## Endpoint Target

### Bengkel

Endpoint operasional:

```text
POST   /transaksi-bengkel/queue
PATCH  /transaksi-bengkel/{id}/order
PATCH  /transaksi-bengkel/{id}/status
POST   /transaksi-bengkel/{id}/void
```

Endpoint settlement:

```text
POST   /transaksi-bengkel/{id}/finalize
POST   /transaksi-bengkel/{id}/invoice
POST   /transaksi-bengkel/{id}/payment
POST   /transaksi-bengkel/{id}/reversal
GET    /transaksi-bengkel/{id}/finance-check
```

Contoh finalize tanpa pembayaran:

```json
{
  "tanggal": "2026-06-05",
  "mode": "invoice",
  "catatan": "Pekerjaan selesai, belum bayar"
}
```

Ekspektasi:

- status kerja menjadi `SELESAI`
- piutang dibuat
- kas tidak berubah
- laporan accrual bisa membaca piutang/laba sesuai rule

Contoh pembayaran:

```json
{
  "tanggal": "2026-06-05",
  "diskon": 10000,
  "payments": [
    {
      "metode": "TUNAI",
      "nominal": 50000,
      "kas_jenis": "KAS_UNIT_BENGKEL"
    },
    {
      "metode": "TRANSFER",
      "nominal": 100000,
      "kas_jenis": "BANK_UTAMA"
    }
  ],
  "catatan": "Pelunasan bengkel"
}
```

### Mobil

Endpoint settlement:

```text
POST /penjualan-mobil/{id}/finalize
POST /penjualan-mobil/{id}/payment
POST /penjualan-mobil/{id}/cancel-booking
POST /penjualan-mobil/{id}/cancel-sale
POST /penjualan-mobil/{id}/investor/disbursement
POST /penjualan-mobil/{id}/investor/reversal
GET  /penjualan-mobil/{id}/finance-check
```

Rule cancel sale:

- Jika investor belum cair: boleh reversal sale.
- Jika investor sudah cair: reject dengan pesan wajib reversal investor.
- Setelah investor reversal: cancel sale boleh jalan.

### Jasa Angkut

Endpoint target:

```text
POST /muatan/{id}/finalize
POST /muatan/{id}/invoice
POST /muatan/{id}/payment
POST /muatan/{id}/void
GET  /muatan/{id}/finance-check
```

Rule:

- `void` harus reversal biaya, kas, dan piutang terkait.
- Biaya operasional harus punya source canonical.

### Reconciliation

Endpoint:

```text
GET /laporan/reconciliation
GET /laporan/reconciliation/kas-bank
GET /laporan/reconciliation/piutang
GET /laporan/reconciliation/hutang
GET /laporan/reconciliation/bengkel
GET /laporan/reconciliation/internal-transfer
```

Contoh response:

```json
{
  "status": "ISSUES_FOUND",
  "critical_count": 1,
  "high_count": 2,
  "findings": [
    {
      "severity": "CRITICAL",
      "code": "BENGKEL_NONFINAL_HAS_KAS",
      "message": "Order bengkel PROSES memiliki mutasi kas",
      "entity": "transaksi_bengkel",
      "entity_id": 123,
      "reference": "BGL2606050001",
      "amount": 50000
    }
  ]
}
```

## Migration Plan

### Migration 1 - Kolom Non-Breaking

Tambahkan kolom nullable/default:

- `finance_status`
- `posted_at`
- `posted_by`
- `void_reason`
- `voided_at`
- `voided_by`
- `source_type`
- `source_id`
- `is_reversal`
- `reversal_of_id`
- `idempotency_key`

Risiko rendah karena tidak mengubah flow existing.

### Migration 2 - Index dan Unique Constraint

Tambahkan index:

- nomor transaksi
- nomor piutang
- nomor hutang
- `source_type + source_id`
- `reversal_of_id`
- `idempotency_key`

Tambahkan unique constraint secara hati-hati setelah audit duplicate existing.

### Migration 3 - Backfill

Isi data lama:

- mapping `finance_status`
- isi `source_type/source_id` untuk KasBank yang bisa ditelusuri dari referensi
- tandai transaksi batal
- tandai internal receivable/payable

Backfill harus read-then-update dan mencetak report perubahan.

### Migration 4 - Enforce

Setelah test dan backfill:

- reject nominal <= 0
- reject finance untuk Bengkel non-final
- reject delete ledger final
- enforce idempotency untuk payment

## Urutan Implementasi Aman

### Sprint 1 - Observability dan Test

Task:

1. Buat `reconciliation_service.py` read-only.
2. Buat endpoint `GET /laporan/reconciliation`.
3. Tambahkan test Bengkel:
   - antre tidak masuk finance
   - proses tidak masuk finance
   - selesai belum bayar menjadi piutang
   - lunas menjadi kas
4. Tambahkan test neraca untuk skenario kecil.
5. Tambahkan validasi nominal payment/diskon.

Acceptance criteria:

- Tidak ada behavior besar berubah.
- Test baru lolos.
- Endpoint reconciliation bisa mendeteksi minimal 5 jenis issue.

### Sprint 2 - Reversal Dasar

Task:

1. Tambah kolom reversal di KasBank.
2. Buat `LedgerReversalService`.
3. Terapkan reversal untuk void Bengkel.
4. Terapkan reversal untuk payment piutang/hutang.
5. Update laporan agar net effect tetap benar.

Acceptance criteria:

- Void tidak delete KasBank lama.
- Reversal terlihat di mutasi.
- Neraca tetap balance setelah void.

### Sprint 3 - Settlement Bengkel

Task:

1. Buat `WorkshopSettlementService`.
2. Pisahkan finalize, invoice, payment, void.
3. Update frontend label/action Bengkel.
4. Tambahkan finance check di detail order.
5. Tambahkan UI pelunasan di riwayat.

Acceptance criteria:

- Buat antrian tidak membuat finance.
- Update order tidak membuat finance.
- Selesai belum bayar membuat piutang.
- Bayar lunas membuat kas.
- User melihat status kerja dan status tagihan terpisah.

### Sprint 4 - Mobil dan Investor

Task:

1. Tambahkan finance check penjualan mobil.
2. Hardening cancel sale investor.
3. Reversal investor disbursement.
4. Audit internal bengkel mobil.
5. Test double count mobil.

Acceptance criteria:

- Cancel sale investor cair ditolak.
- Reversal investor bisa dilakukan.
- Laporan tidak double count internal repair.

### Sprint 5 - Jasa Angkut

Task:

1. Tetapkan rule piutang JA.
2. Refactor biaya operasional canonical.
3. Tambahkan void muatan dengan reversal.
4. Audit repair JA internal.
5. Test biaya tidak double.

Acceptance criteria:

- Piutang JA sesuai rule tunggal.
- Biaya operasional muncul sekali.
- Muatan batal tidak masuk laporan.

## UI Implementation Plan

### Bengkel Dashboard

Tampilkan dua dimensi:

```text
Status Kerja: Antre / Proses / Selesai / Batal
Status Tagihan: Belum Ditagih / Belum Bayar / Cicilan / Lunas
```

Action per status:

| Kondisi | Action utama |
| --- | --- |
| Antre | Update Order, Mulai Proses, Cetak Order Slip |
| Proses | Update Order, Selesaikan Pekerjaan, Cetak Order Slip |
| Selesai belum tagih | Buat Tagihan, Bayar Sekarang |
| Selesai belum bayar | Pelunasan, Cetak Invoice |
| Lunas | Cetak Struk |
| Batal | Lihat Detail |

### Rincian Order

Tambahkan section:

- Info pekerjaan
- Item order
- Ringkasan tagihan
- Status finance
- Riwayat pembayaran
- Dokumen: Order Slip / Invoice / Receipt

### Finance Screens

Tambahkan link balik:

- Mutasi kas -> transaksi asal
- Piutang -> invoice/order asal
- Hutang -> pembelian/transaksi asal
- Laporan -> drilldown sumber angka

## Backend Acceptance Criteria

### Umum

- Semua endpoint payment validasi nominal > 0.
- Semua endpoint payment mendukung idempotency.
- Semua void transaksi final memakai reversal.
- Semua service settlement commit sekali per operasi.
- Semua realtime event dikirim setelah commit.

### Bengkel

- `ANTRE/PROSES` tidak bisa punya finance entry baru.
- `SELESAI + belum bayar` membuat piutang.
- `SELESAI + lunas` membuat kas masuk.
- `BATAL` restore stok dan reversal finance.

### Mobil

- Double sale ditolak.
- Investor disbursement/reversal punya histori.
- Internal repair punya source jelas.

### JA

- Piutang basis konsisten.
- Biaya operasional tidak double.
- Muatan batal direversal.

## Test Plan

### Unit Test

- Status transition validator.
- Payment split validator.
- Reversal amount/direction.
- Finance classification mapper.
- Rupiah parser/formatter frontend utility.

### Integration Test

- Bengkel lifecycle full.
- Mobil lifecycle full.
- JA lifecycle full.
- Piutang payment.
- Hutang payment.
- Neraca balance after each lifecycle.

### Regression Test

- Bug Rp0 di KasBank dari antrian Bengkel.
- Selesai belum bayar membuat selisih neraca.
- Internal repair double count.
- Duplicate payment karena retry.
- Cancel sale investor setelah payout.

## Risiko Implementasi

### Risiko 1 - Backfill Salah

Dampak:

- Data historis berubah dan laporan periode lama bergeser.

Mitigasi:

- Backfill dry-run dulu.
- Simpan file report sebelum update.
- Jalankan pada copy database.
- Update per batch kecil.

### Risiko 2 - UI dan Backend Tidak Serempak

Dampak:

- UI masih mengirim payload lama ke endpoint baru.

Mitigasi:

- Endpoint lama tetap kompatibel sementara.
- Tambahkan deprecation warning internal.
- Update service frontend setelah backend stabil.

### Risiko 3 - Reversal Mengubah Laporan

Dampak:

- Laporan lama berubah jika reversal tanggal hari ini vs tanggal transaksi asli tidak jelas.

Mitigasi:

- Reversal punya tanggal reversal.
- Laporan historis as-of-date menghitung sesuai tanggal transaksi.
- UI tampilkan riwayat reversal.

### Risiko 4 - Test Tidak Mencakup Data Nyata

Dampak:

- Test hijau tetapi data production tetap punya mismatch.

Mitigasi:

- Reconciliation endpoint wajib jalan di data real.
- Tambahkan dashboard issue.
- Jangan enforce constraint sebelum issue existing dibersihkan.

## Definition of Ready

Sebelum implementasi task finansial:

- Rule bisnis sudah tertulis.
- Source data diketahui.
- Dampak ke kas/piutang/hutang/laporan diketahui.
- Test scenario sudah ada.
- Rollback/reversal strategy jelas.

## Definition of Done

Task finansial dianggap selesai jika:

- Test backend lolos.
- Test frontend typecheck lolos jika UI berubah.
- Reconciliation tidak menambah issue baru.
- Neraca balance untuk skenario terkait.
- Laba rugi tidak double count.
- UI label sesuai status.
- Dokumentasi guardrail diperbarui jika rule berubah.

## Kesimpulan Audit 3

Audit 3 merekomendasikan hardening bertahap, bukan rewrite total. Urutan paling aman adalah:

1. Observability dan test.
2. Reversal ledger.
3. Settlement Bengkel.
4. Settlement Mobil dan investor.
5. Settlement Jasa Angkut.
6. Drilldown reconciliation di laporan.

Jika blueprint ini diikuti, TPM akan bergerak dari sistem transaksi yang banyak cabang menjadi sistem operasional-finansial yang lebih mudah diaudit: status jelas, ledger immutable, reversal eksplisit, dan laporan bisa ditelusuri sampai transaksi asal.
