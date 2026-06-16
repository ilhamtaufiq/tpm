# Plan TPM

Folder ini berisi dokumen audit dan rencana eksekusi MVP untuk aplikasi TPM Tiga Putra Motor.

## Urutan Baca

1. `audit1.md`
   - Audit proses bisnis dan risiko besar.
   - Fokus: Bengkel, Jual Beli Mobil, Jasa Angkut, Keuangan, Laporan, UI/UX.

2. `audit2.md`
   - Lanjutan audit berupa invariant data, test matrix, dan kontrol operasional.
   - Fokus: aturan yang tidak boleh dilanggar backend dan daftar cek rekonsiliasi.

3. `audit3.md`
   - Blueprint implementasi teknis.
   - Fokus: state machine, settlement service, reversal ledger, endpoint target, migration, dan sprint.

4. `mvp-fitur.md`
   - Rencana MVP fitur per modul.
   - Fokus: scope fitur wajib, task backend/frontend, acceptance criteria.

5. `task.md`
   - Backlog eksekusi prioritas.
   - Fokus: checklist P0-P3 yang bisa langsung dikerjakan.

## Prioritas Eksekusi

Mulai dari `task.md`:

1. **P0 - Guardrail Finansial dan Laporan**
   - Bengkel tidak boleh masuk finance sebelum final.
   - Selesai belum bayar harus menjadi piutang.
   - Validasi nominal uang.
   - Reconciliation read-only.

2. **P1 - MVP Inti**
   - Bengkel.
   - Laporan Keuangan.
   - Jual Beli Mobil.
   - Jasa Angkut.

3. **P2 - Data Safety dan UI/UX**
   - Reversal ledger.
   - Idempotency payment.
   - Audit trail.
   - Status/action UI.

4. **P3 - Refactor Lanjutan**
   - Settlement service.
   - Canonical finance classification.
   - Drilldown laporan.

## Prinsip Utama

- Antrian/proses operasional belum tentu transaksi finansial.
- Transaksi finansial harus punya sumber dan referensi.
- Transaksi final tidak boleh dihapus diam-diam; gunakan reversal.
- Laporan harus bisa ditelusuri sampai transaksi asal.
- UI harus membedakan status kerja dan status bayar.

## Dokumen Terkait

- `.agent/FINANCE_REPORTING_GUARDRAIL.md`
- `README.md` di root project

## Cara Pakai Saat Eksekusi

Untuk setiap task:

1. Baca acceptance criteria di `task.md`.
2. Cek rule bisnis di `audit1.md` dan `audit2.md`.
3. Jika task menyentuh arsitektur settlement/reversal, cek `audit3.md`.
4. Implementasi perubahan.
5. Jalankan test atau verifikasi manual yang relevan.
6. Pastikan tidak ada record finance Rp0 dan neraca tidak bertambah selisih.
