# Import Existing Data (Multi-sheet XLSX)

## Status
Implemented MVP (2026-07-20).

## API (Admin only)
- `GET /api/v1/data-import/template` — download workbook
- `POST /api/v1/data-import/preview` — dry-run
- `POST /api/v1/data-import/commit` — all-or-nothing commit

## Sheets
`_INSTRUKSI`, `customers`, `suppliers`, `spare_parts`, `jasa_servis`, `karyawan`,
`kas_opening`, `hutang_opening`, `piutang_opening`, `armada`, `supir`, `mobil`

## UI
Profile → Sesi & Data → **Import Data (Excel)** → `/settings/data-import`

## Idempotency
- Kas / hutang / piutang opening: `nomor_referensi = IMP-{batch}-{...}`
- Re-import same file keys → skipped (kas) or same ref skip (hutang/piutang)

## Out of scope (phase 2)
Full histori transaksi bengkel / muatan / penjualan mobil.
