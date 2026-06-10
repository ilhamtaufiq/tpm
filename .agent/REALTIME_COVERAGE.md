# Realtime / WS Coverage

Status: partial coverage, verified for current backend emitters and frontend consumer.

## Ringkasan

Realtime di TPM sudah jalan end-to-end:
- backend publish event via `publish_realtime_event()`;
- frontend connect ke `/api/v1/realtime/ws`;
- client push notifikasi lokal;
- query invalidation berbasis `scope`.

Coverage belum 100 persen di seluruh fitur. Beberapa area hanya ter-cover lewat invalidation scope, bukan emitter khusus per action.

## Current Architecture

- Backend socket: [`backend/app/realtime.py`](../backend/app/realtime.py)
- Frontend socket client: [`frontend/services/realtime.ts`](../frontend/services/realtime.ts)
- Global bootstrap: [`frontend/app/_layout.tsx`](../frontend/app/_layout.tsx)
- Local notification store: [`frontend/store/useNotificationStore.ts`](../frontend/store/useNotificationStore.ts)

## Scope Mapping

| Scope | Query key invalidation |
|---|---|
| `bengkel` | `transaksi_bengkel`, `transaksi_bengkel_summary`, `recent_activity`, `capital_report`, `laba_rugi_report`, `neraca_report`, `validate_reports`, `spare_parts`, `spare_parts_low_stock`, `spare_parts_stats`, `pembelian_parts`, `pengeluaran`, `piutang_list`, `piutang_summary`, `kas_bank_balances`, `kas_bank_list`, `dashboard_summary` |
| `jasa_angkut` | `muatan`, `muatan_summary`, `recent_activity`, `capital_report`, `laba_rugi_report`, `neraca_report`, `validate_reports`, `muatan_suggestions`, `muatan_supir`, `supir`, `supir_active`, `armada`, `armada_active`, `armada_detail`, `piutang_list`, `piutang_summary`, `hutang_list`, `hutang_summary`, `kas_bank_balances`, `kas_bank_list`, `dashboard_summary` |
| `mobil` | `mobils`, `mobils_summary`, `recent_activity`, `capital_report`, `laba_rugi_report`, `neraca_report`, `validate_reports`, `inventory_summary`, `kas_bank_balances`, `kas_bank_list`, `piutang_list`, `piutang_summary`, `hutang_list`, `hutang_summary`, `dashboard_summary` |
| `finance` | `kas_bank_balances`, `kas_bank_list`, `recent_activity`, `capital_report`, `laba_rugi_report`, `neraca_report`, `validate_reports`, `piutang_list`, `piutang_summary`, `hutang_list`, `hutang_summary`, `dashboard_summary`, `user_cash_history` |
| `master` | `spare_parts`, `spare_parts_low_stock`, `spare_parts_stats`, `capital_report`, `laba_rugi_report`, `neraca_report`, `validate_reports`, `customers`, `supir`, `supir_active`, `armada`, `armada_active` |
| `users` | `users`, `user`, `security`, `capital_report`, `laba_rugi_report`, `neraca_report`, `validate_reports` |
| `settings` | `security`, `settings`, `capital_report`, `laba_rugi_report`, `neraca_report`, `validate_reports` |

## Backend Emitters

Terlihat emit realtime aktif di:
- `backend/app/services/transaksi_bengkel_service.py`
- `backend/app/services/muatan_service.py`
- `backend/app/services/mobil_service.py`
- `backend/app/services/spare_part_service.py`
- `backend/app/services/customer_service.py`
- `backend/app/services/armada_service.py`
- `backend/app/services/supir_service.py`
- `backend/app/services/pengeluaran_service.py`
- `backend/app/services/user_cash_service.py`
- `backend/app/services/kas_bank_service.py`
- `backend/app/services/kas_bank_integration.py`

## Per-Service Audit

| Service | Actions yang ter-cover | Status | Catatan |
|---|---|---|---|
| `transaksi_bengkel_service.py` | `created`, `updated`, `payment_updated`, `status_updated`, `voided` | covered | Emit ke scope `bengkel`, dan ikut scope `jasa_angkut` / `mobil` kalau kategori transaksi internal. |
| `muatan_service.py` | `created`, `updated`, `paid`, `paid_split`, `deleted`, `voided`, `biaya_added`, `biaya_deleted` | covered | Emit ke scope `jasa_angkut`. Ini sudah mencakup alur operasi + biaya tambahan + batal. |
| `mobil_service.py` | `created`, `updated`, `status_updated`, `deleted`, `biaya_added`, `biaya_deleted`, `part_service_added`, `part_service_deleted`, `media_uploaded`, `media_deleted` | covered | Cover penuh untuk data mobil, histori biaya, dan media. |
| `spare_part_service.py` | `created`, `updated`, `image_uploaded`, `deleted`, `stock_updated`, `price_updated`, `bulk_deleted` | covered | Coverage master sparepart lengkap, termasuk stok dan harga. |
| `customer_service.py` | `created`, `updated`, `deleted` | covered | Emit ke scope `master`. |
| `armada_service.py` | `created`, `updated`, `deleted`, `expense_added` | covered | Emit ke scope `master`; expense armada ikut ter-cover. |
| `supir_service.py` | `created`, `updated`, `status_updated`, `deleted` | covered | Emit ke scope `master`. |
| `pengeluaran_service.py` | `created`, `updated`, `deleted` | covered | Emit ke scope `finance`. |
| `user_cash_service.py` | `adjusted`, `set` | covered | Emit ke scope `users`. |
| `kas_bank_service.py` + `kas_bank_integration.py` | `created` via helper, `transfer`, `adjusted` | covered via helper | `create_kas_entry()` yang publish `created`; `KasBankService.transfer/adjust_balance` publish `transfer/adjusted`. |

## Endpoint-Level Audit

### Covered mutation routes
- `backend/app/api/v1/transaksi_bengkel.py`
  - `POST /transaksi-bengkel`
  - `PATCH /transaksi-bengkel/{id}/payment`
  - `PUT /transaksi-bengkel/{id}`
  - `PATCH /transaksi-bengkel/{id}/status`
  - `DELETE /transaksi-bengkel/{id}`
- `backend/app/api/v1/muatan.py`
  - `POST /muatan`
  - `PUT /muatan/{id}`
  - `PATCH /muatan/{id}/paid`
  - `POST /muatan/{id}/paid-split`
  - `PATCH /muatan/{id}/status`
  - `DELETE /muatan/{id}`
  - `POST /muatan/{id}/void`
  - `POST /muatan/{id}/biaya`
  - `DELETE /muatan/{id}/biaya/{biaya_id}`
- `backend/app/api/v1/mobil.py`
  - create/update/status/delete
  - biaya / part-service / media add-delete
- `backend/app/api/v1/spare_parts.py`
  - create/update/stock/price/delete/bulk-delete/image
- `backend/app/api/v1/customers.py`
  - create/update/delete
- `backend/app/api/v1/armada.py`
  - create/update/delete/expense
- `backend/app/api/v1/supir.py`
  - create/update/active/delete
- `backend/app/api/v1/pengeluaran.py`
  - create/update/delete
- `backend/app/api/v1/kas_bank.py`
  - create/transfer/adjust
- `backend/app/api/v1/user_cash.py`
  - adjust/set

### Gap routes without realtime emitter detected
- `backend/app/api/v1/absensi.py`
  - create/bulk/update/delete/clock-in/clock-out
- `backend/app/api/v1/slip_gaji.py`
  - create/bulk/pay/void/delete
- `backend/app/api/v1/kasbon.py`
  - create/mark-paid/pay-split/delete
- `backend/app/api/v1/jasa_servis.py`
  - create/update/delete
- `backend/app/api/v1/karyawan.py`
  - create/update/status/delete
- `backend/app/api/v1/auth.py`
  - `PUT /me`, avatar, background, change-password, user admin CRUD, impersonate
- `backend/app/api/v1/penjualan_mobil.py`
  - create/update-payment/cancel/disburse
- `backend/app/api/v1/pembelian_parts.py`
  - create/update/payment/delete
- `backend/app/api/v1/maintenance.py`
  - reset/sync utility actions

## Endpoint Audit Notes

- Coverage disebut "covered" hanya jika route mutasi memicu service yang memang publish realtime.
- Kalau route hanya read-only, statusnya tidak dihitung sebagai gap realtime.
- Route finance/laporan yang hanya query tetap wajib ikut refresh melalui scope invalidation, tapi tidak perlu emitter sendiri kecuali ada aksi mutasi.

## Priority To Close Gaps

### P0 - Finance / laporan critical
1. `backend/app/api/v1/penjualan_mobil.py`
2. `backend/app/api/v1/kasbon.py`
3. `backend/app/api/v1/slip_gaji.py`
4. `backend/app/api/v1/pembelian_parts.py`

Alasan:
- langsung mengubah kas, piutang, hutang, modal, atau laporan konsolidasi;
- jika tidak emit realtime, dashboard dan laporan cepat stale;
- dampaknya lintas unit, bukan hanya satu layar.

### P1 - Master / operational critical
1. `backend/app/api/v1/jasa_servis.py`
2. `backend/app/api/v1/karyawan.py`
3. `backend/app/api/v1/absensi.py`

Alasan:
- memengaruhi data referensi dan operasional harian;
- penting untuk konsistensi UI dan workflow, tapi dampak laporan lebih tidak langsung dibanding P0.

### P2 - Auth / admin maintenance
1. `backend/app/api/v1/auth.py`
2. `backend/app/api/v1/maintenance.py`

Alasan:
- lebih ke profil, security, impersonation, dan utilitas;
- penting untuk UX dan audit trail, tapi bukan sumber utama angka laporan.

## Coverage Notes

### Covered
- Create/update/delete di modul operasional utama.
- Mutasi kas dan penyesuaian saldo.
- Notifikasi live untuk entity/action yang diekspose emitter.
- Refresh query utama per scope.

### Partial
- Laporan tidak punya emitter khusus per laporan.
- Laporan ikut update hanya kalau data sumber mem-publish scope yang benar.
- Beberapa event masih memakai payload minimum: `scope`, `entity`, `action`, `entity_id`, `data`.

### Gaps
- Belum ada matriks formal per endpoint/service untuk memastikan semua mutation mem-publish event.
- Belum ada test otomatis yang memverifikasi publish/invalidation untuk tiap domain.
- Tidak semua screen yang hanya baca data punya fallback refresh khusus saat websocket putus.
- Coverage audit per service di atas masih berdasarkan implementasi emitter yang ditemukan; kalau ada service baru yang menulis data operasional, wajib masuk matrix ini juga.
- Endpoint-level gap terbesar sekarang ada di auth, absensi, slip gaji, kasbon, karyawan, jasa servis, penjualan mobil, dan pembelian parts.

## Checklist Saat Menambah Fitur Baru

1. Tentukan `scope` yang benar.
2. Emit event dari service layer.
3. Tambahkan invalidation key kalau data baru dipakai screen lain.
4. Pastikan notifikasi punya `entity`, `action`, dan `entityId`.
5. Jalankan verifikasi end-to-end.
6. Update dokumen ini jika cakupan berubah.

## Rule

Jangan anggap fitur realtime selesai hanya karena websocket connect.
Selesai berarti:
- event ter-publish,
- scope benar,
- UI refresh,
- notifikasi informatif,
- dan laporan tidak stale.
