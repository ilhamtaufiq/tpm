# Rencana Implementasi AI Agent - Detail Temuan, Risiko, dan Rekomendasi Prioritas

Tanggal: 30 Mei 2026
Scope: flow keuangan TPM untuk Bengkel, Jasa Angkut, Jual Beli Mobil, Kas/Bank, Piutang, Hutang, Neraca, Laba Rugi, dan Perubahan Modal.

## Tujuan

Dokumen ini dipakai sebagai rencana kerja implementasi untuk AI agent. Targetnya bukan hanya mendokumentasikan temuan, tetapi juga mengeksekusi perbaikan secara bertahap, terukur, dan bisa divalidasi.

## Hasil Akhir Yang Diinginkan

1. Klasifikasi hutang manual vs pinjaman jelas dan tidak bergantung pada inferensi semata.
2. Dompet unit menampilkan hutang/piutang aktif yang benar berdasarkan `unit` dan status.
3. Laporan Neraca, Laba Rugi, dan Perubahan Modal konsisten satu sama lain.
4. Angka summary frontend tidak salah akibat string Decimal yang dijumlahkan sebagai teks.
5. Internal elimination terdokumentasi dan lebih mudah diaudit.

## Prioritas Implementasi

| Prioritas | Fokus | Alasan |
| --- | --- | --- |
| P0 | Salah klasifikasi hutang manual, filter dompet unit, parsing angka | Dampaknya langsung ke saldo dan laporan inti |
| P1 | Transparansi laporan, label UI, test otomatis | Mencegah salah interpretasi dan regresi |
| P2 | Audit trail, pemisahan modal non-kas, penyempurnaan struktur report | Memperkuat maintainability |

## Fase Implementasi

### Fase 1: Stabilkan Klasifikasi Hutang

Target:

- Hutang manual non-pinjaman diperlakukan sebagai beban akrual.
- Hutang pinjaman kas tetap dianggap pendanaan, bukan beban.
- Laporan tidak lagi selisih akibat hutang manual.

Langkah kerja:

1. Tambahkan field eksplisit untuk jenis hutang manual.
2. Bedakan flow input hutang:
   - `PINJAMAN_KAS`
   - `BEBAN_AKRUAL`
   - `PEMBELIAN_ASET`
   - `LAINNYA`
3. Pertahankan mapping laporan:
   - Pinjaman kas masuk ke hutang tanpa memengaruhi laba.
   - Beban akrual masuk ke laba/rugi dan menurunkan laba ditahan.
4. Tambahkan label UI yang lebih tegas di form hutang.

Output:

- Tidak ada lagi kebingungan antara hutang warung dan hutang pinjaman.
- Neraca dan Perubahan Modal balance untuk skenario hutang manual.

Checklist validasi:

- Hutang warung 2.300.000 tanpa cash/transfer/split menurunkan laba.
- Hutang pinjaman 2.300.000 dengan cash/transfer/split tidak menurunkan laba.
- Pembayaran hutang mengurangi sisa hutang dan kas, tanpa double expense.

### Fase 2: Benahi Dompet Unit

Target:

- Dompet Bengkel, Jasa Angkut, dan Mobil selalu membaca hutang/piutang aktif yang benar.
- Filter tidak bergantung pada `sumber` yang terlalu sempit.

Langkah kerja:

1. Gunakan `unit=<UNIT>` dan `status=BELUM_LUNAS` sebagai filter utama.
2. Hindari filter `sumber` untuk kartu hutang/piutang di dompet.
3. Samakan pola query di semua unit bisnis.
4. Tambahkan pengecekan jumlah aktif di kartu dompet.

Output:

- Bengkel menampilkan hutang manual `LAINNYA` yang memang milik unit Bengkel.
- Jasa Angkut dan Mobil tetap konsisten dengan pola yang sama.

Checklist validasi:

- Kartu hutang dompet Bengkel tidak 0 jika ada hutang aktif.
- Kartu hutang dompet Jasa Angkut dan Mobil menampilkan data aktif yang sesuai.

### Fase 3: Rapikan Penyajian Laporan

Target:

- Laba positif tampil sebagai penambahan ekuitas.
- Rugi tampil sebagai pengurangan ekuitas.
- Laba Ditahan dan modal akhir mudah direkonsiliasi.

Langkah kerja:

1. Pindahkan `Rugi Periode` ke bagian pengurangan.
2. Tampilkan `Laba Bersih Periode` hanya bila nilainya positif.
3. Pastikan export PDF mengikuti pola yang sama.
4. Tambahkan label beban hutang manual/akrual pada laporan yang relevan.

Output:

- Perubahan Modal lebih mudah dibaca.
- Tidak ada lagi pertanyaan kenapa rugi ditaruh di penambahan.

Checklist validasi:

- Laba positif muncul di Penambahan.
- Rugi negatif muncul di Pengurangan.
- Export dan preview memiliki isi yang sama.

### Fase 4: Audit Parsing Angka Frontend

Target:

- Summary total hutang/piutang tidak salah karena string Decimal.

Langkah kerja:

1. Pastikan semua penjumlahan summary memakai `Number(...)`.
2. Audit halaman yang memakai `total_sisa`, `sisa_hutang`, `sisa_piutang`, `nominal_hutang`, `nominal_piutang`.
3. Tambahkan helper parsing standar bila perlu.
4. Cek semua kartu summary di dompet dan laporan.

Output:

- Tidak ada lagi total yang membengkak karena concatenation string.
- Angka summary konsisten dengan detail list.

Checklist validasi:

- Total hutang tidak berubah menjadi gabungan string.
- Total piutang tidak melewati nilai logis saat data banyak.

### Fase 5: Dokumentasi Eliminasi Internal

Target:

- Internal transaction lebih mudah dipahami dan diaudit.

Langkah kerja:

1. Dokumentasikan aturan internal Bengkel ke Mobil.
2. Dokumentasikan aturan internal Bengkel ke Jasa Angkut.
3. Jelaskan peran `is_internal` pada piutang dan hutang.
4. Tandai komponen yang dikapitalisasi ke stok vs yang menjadi beban.

Output:

- Developer baru tidak perlu menebak logika eliminasi.
- Audit laporan lebih cepat.

## Rencana Kerja Teknis Per Area

### Backend

Prioritas:

1. `backend/app/services/reports/base.py`
2. `backend/app/services/reports/neraca_service.py`
3. `backend/app/services/reports/modal_service.py`
4. `backend/app/services/hutang_service.py`
5. `backend/app/services/piutang_service.py`

Tujuan:

- Memastikan laporan konsolidasi sesuai transaksi.
- Memisahkan beban akrual dari pinjaman.
- Menjaga internal elimination tetap konsisten.

### Frontend

Prioritas:

1. `frontend/app/bengkel/index.tsx`
2. `frontend/app/jasa-angkut/index.tsx`
3. `frontend/app/mobil/index.tsx`
4. `frontend/app/finance/hutang.tsx`
5. `frontend/app/finance/piutang.tsx`
6. `frontend/app/laporan/neraca.tsx`
7. `frontend/app/laporan/perubahan-modal.tsx`
8. `frontend/utils/reportTemplates.ts`

Tujuan:

- Dompet unit menampilkan data aktif yang benar.
- Laporan konsisten dengan backend.
- Export PDF identik dengan preview layar.

## Risiko Implementasi

### Risiko 1: Double Count Beban Akrual

Jika hutang manual non-pinjaman dan pengeluaran kredit mencatat transaksi yang sama, beban bisa dihitung dua kali.

Mitigasi:

- Perjelas aturan input.
- Tambahkan validasi di form dan service.
- Tambahkan test untuk satu transaksi hanya muncul di satu jalur akuntansi.

### Risiko 2: Filter Unit Tidak Konsisten

Jika ada halaman yang masih pakai filter `sumber`, data unit bisa hilang.

Mitigasi:

- Jadikan `unit` filter utama di dompet.
- Buat audit grep untuk semua `useHutangList` dan `usePiutangList`.

### Risiko 3: Angka Decimal Masih Terkirim Sebagai String

Jika parsing tidak seragam, summary bisa salah total.

Mitigasi:

- Konversi eksplisit ke number di frontend.
- Tambahkan helper parsing bersama.

### Risiko 4: Eliminasi Internal Mengganggu Perubahan Modal

Jika internal elimination dan kapitalisasi stok tidak sinkron, laporan modal bisa selisih.

Mitigasi:

- Simpan aturan eliminasi di satu dokumen teknis.
- Tambahkan test snapshot untuk tanggal sampel.

## Urutan Eksekusi Yang Disarankan

1. Kunci klasifikasi hutang manual.
2. Benahi dompet unit Bengkel/Jasa Angkut/Mobil.
3. Rapikan label laporan perubahan modal.
4. Audit parsing angka frontend.
5. Dokumentasikan internal elimination dan buat test snapshot.

## Kriteria Selesai

Implementasi dianggap selesai jika:

- Hutang manual non-pinjaman dan hutang pinjaman menghasilkan dampak laporan yang berbeda dengan benar.
- Semua dompet unit menampilkan hutang/piutang aktif yang sesuai.
- Neraca balance pada skenario hutang manual, pinjaman, dan pembayaran.
- Perubahan Modal menampilkan laba/rugi pada posisi yang benar.
- Tidak ada summary total yang salah karena string Decimal.

## Catatan Untuk AI Agent

Saat menjalankan implementasi:

- Mulai dari sumber data backend, bukan dari UI.
- Jangan mengubah logika laporan hanya untuk menutupi selisih.
- Jika ada selisih, cari sumber klasifikasi transaksi terlebih dahulu.
- Pertahankan prinsip: transaksi kas, akrual, dan internal harus dipisah jelas.
