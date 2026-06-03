# Change Request Templates

Gunakan file ini sebagai standar saat owner meminta penambahan, perubahan, atau perbaikan fitur.

## 1) Template Owner-Friendly

Pakai ini untuk komunikasi cepat ke owner atau user non-teknis.

```md
# Permintaan Perubahan / Fitur

## Informasi Dasar
- Judul:
- Jenis request: Fitur baru / Perubahan / Perbaikan / Optimasi
- Tanggal request:
- Requester:
- Prioritas:
- Status:

## Masalah Saat Ini
- Apa yang tidak berjalan / kurang:
- Dampak ke operasional:

## Tujuan
- Hasil yang diharapkan:
- Nilai bisnis:

## Ruang Lingkup
- Yang diminta:
- Yang termasuk:
- Yang tidak termasuk:

## Lokasi di Aplikasi
- Halaman / menu:
- Modul:
- Role terdampak:

## Alur Singkat
- Sebelum:
- Sesudah:

## Data yang Terlibat
- Field input:
- Field output:
- Data yang berubah:

## Aturan Khusus
- Validasi:
- Batasan:
- Default value:

## Acceptance Criteria
- [ ] ...
- [ ] ...
- [ ] ...

## Catatan
- Risiko:
- Dependency:
- Catatan lain:
```

## 2) Template Formal

Pakai ini untuk dokumentasi perubahan yang lebih lengkap dan rapi.

```md
# Change Request

## 1. Identitas
- ID Request:
- Judul:
- Tipe:
- Requester:
- Owner:
- Tanggal request:
- Target release:
- Status:

## 2. Latar Belakang
- Masalah bisnis:
- Pain point user:
- Alasan perubahan:

## 3. Ruang Lingkup
- In scope:
- Out of scope:
- Modul terdampak:
- Halaman terdampak:
- API terdampak:
- Database terdampak:

## 4. Desain Perubahan
- Alur lama:
- Alur baru:
- Perubahan UI:
- Perubahan data:
- Perubahan validasi:

## 5. Aturan Bisnis
- Rule 1:
- Rule 2:
- Rule 3:

## 6. Data Specification
- Field:
- Tipe data:
- Wajib / opsional:
- Default:
- Catatan:

## 7. Acceptance Criteria
- [ ] ...
- [ ] ...
- [ ] ...

## 8. Testing
- Skenario test:
- Expected result:
- Edge case:

## 9. Risiko dan Mitigasi
- Risiko:
- Dampak:
- Mitigasi:
- Rollback plan:

## 10. Approval
- Disetujui oleh:
- Tanggal approval:
- Catatan approval:
```

## 3) Template Dev + QA + Owner

Pakai ini kalau satu dokumen harus dipakai lintas tim.

```md
# Feature / Change Specification

## A. Ringkasan
- Judul:
- Tipe:
- Prioritas:
- Status:
- Owner:
- Dev PIC:
- QA PIC:
- Tanggal request:
- Tanggal implementasi:

## B. Masalah / Tujuan
- Masalah saat ini:
- Tujuan bisnis:
- Definisi sukses:

## C. Scope
- In scope:
- Out of scope:
- Modul / layar terdampak:
- Role terdampak:

## D. Detail Fitur
- Deskripsi fitur:
- Alur pengguna:
- Kondisi awal:
- Kondisi akhir:
- Empty state:
- Error state:

## E. Data & API
- Endpoint terkait:
- Request payload:
- Response payload:
- Field baru / berubah:
- Validasi server:
- Validasi client:

## F. UI / UX
- Komponen yang berubah:
- Label / copy:
- State tombol:
- Loading state:
- Responsive behavior:

## G. Aturan Bisnis
- Rule 1:
- Rule 2:
- Rule 3:
- Hak akses:

## H. Acceptance Criteria
- [ ] Data tampil benar
- [ ] Validasi berjalan sesuai aturan
- [ ] Aksi simpan / ubah / hapus berhasil
- [ ] Error message jelas
- [ ] Permission sesuai role

## I. Test Cases
- Case 1:
- Case 2:
- Case 3:
- Edge case:

## J. Risiko
- Risiko implementasi:
- Risiko data:
- Risiko operasional:
- Mitigasi:

## K. Deployment Notes
- Migration:
- Backward compatibility:
- Rollback:
- Monitoring:
```

## 4) Kolom yang Sebaiknya Selalu Ada

Kalau ingin standardisasi yang konsisten, setiap request minimal punya:

- `Judul`
- `Jenis request`
- `Requester`
- `Tanggal request`
- `Masalah saat ini`
- `Tujuan bisnis`
- `Ruang lingkup`
- `Modul terdampak`
- `Role terdampak`
- `Alur sebelum`
- `Alur sesudah`
- `Data / field yang berubah`
- `Aturan bisnis`
- `Acceptance criteria`
- `Risiko`
- `Status`

## 5) Saran Praktis

- Pakai template owner-friendly untuk request awal.
- Naikkan ke template formal saat scope sudah disetujui.
- Pakai template dev + QA + owner untuk pekerjaan yang akan dieksekusi.
- Simpan satu file per request dengan format nama seperti:
  - `CR-2026-06-03-tambah-filter-sparepart.md`
  - `CR-2026-06-03-perbaikan-search-transaksi.md`

