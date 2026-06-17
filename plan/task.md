# Task Eksekusi MVP TPM

Tanggal: 2026-06-06

Sumber:

- `plan/audit1.md`
- `plan/audit2.md`
- `plan/audit3.md`
- `plan/mvp-fitur.md`

Dokumen ini adalah backlog eksekusi berdasarkan prioritas. Urutan dibuat untuk mengurangi risiko laporan/finance rusak sebelum fitur lanjutan dikerjakan.

## Prioritas

- **P0:** wajib dikerjakan dulu; mencegah bug finansial kritikal.
- **P1:** fitur MVP inti; membuat flow harian stabil.
- **P2:** hardening dan UX; mengurangi salah input dan memperjelas status.
- **P3:** optimasi/refactor lanjutan; dikerjakan setelah MVP stabil.

## P0 - Guardrail Finansial dan Laporan

### P0.1 Bengkel tidak boleh masuk finance sebelum final

- [ ] Audit `backend/app/services/transaksi_bengkel_service.py` untuk semua jalur create/update/status/payment.
- [ ] Pastikan `ANTRE` tidak membuat `KasBank`.
- [ ] Pastikan `ANTRE` tidak membuat `PiutangUsaha`.
- [ ] Pastikan `ANTRE` tidak membuat `HutangUsaha`.
- [ ] Pastikan `PROSES` tidak membuat `KasBank`.
- [ ] Pastikan `PROSES` tidak membuat `PiutangUsaha`.
- [ ] Pastikan `PROSES` tidak membuat `HutangUsaha`.
- [ ] Pastikan laporan finance memakai filter `status_pengerjaan = SELESAI`.
- [ ] Tambahkan test: buat antrian tanpa item tidak mengubah finance.
- [ ] Tambahkan test: buat antrian dengan item tidak mengubah finance.
- [ ] Tambahkan test: update order antre/proses tidak mengubah finance.

Acceptance criteria:

- Tidak ada record Rp0 dari antrian/proses bengkel di keuangan.
- Dashboard finance dan laporan tidak membaca order bengkel non-final.

### P0.2 Selesai belum bayar harus konsisten

- [ ] Tetapkan rule: `SELESAI + belum bayar` membuat piutang bengkel.
- [ ] Pastikan finalize selesai tanpa pembayaran membuat `PiutangUsaha`.
- [ ] Pastikan kas/bank tidak naik saat belum ada pembayaran.
- [ ] Pastikan status bayar menjadi `BELUM_LUNAS` atau `CICILAN` sesuai nominal bayar.
- [ ] Tambahkan test: selesai belum bayar -> piutang naik, kas tetap.
- [ ] Tambahkan test: neraca balance setelah selesai belum bayar.

Acceptance criteria:

- Order bengkel selesai belum bayar tidak membuat selisih neraca.

### P0.3 Validasi nominal uang

- [ ] Backend reject payment `<= 0`.
- [ ] Backend reject diskon negatif.
- [ ] Backend reject diskon lebih besar dari subtotal.
- [ ] Backend cap payment ke grand total atau catat kembalian secara eksplisit.
- [ ] Frontend samakan default nominal bayar dan diskon.
- [ ] Frontend gunakan formatter/parser Rupiah yang sama untuk nominal dan diskon.

Acceptance criteria:

- Tidak ada `KasBank`, `PiutangUsaha`, atau `HutangUsaha` baru dengan nominal 0/negatif.

### P0.4 Reconciliation read-only

- [ ] Buat `backend/app/services/reconciliation_service.py` atau lokasi setara.
- [ ] Cek KasBank nominal 0/negatif.
- [ ] Cek KasBank Bengkel yang referensinya `ANTRE/PROSES`.
- [ ] Cek piutang lunas tapi sisa > 0.
- [ ] Cek hutang lunas tapi sisa > 0.
- [ ] Cek stok sparepart negatif.
- [ ] Cek neraca selisih.
- [ ] Buat endpoint `GET /laporan/reconciliation`.
- [ ] Tambahkan UI minimal tombol `Cek Rekonsiliasi` di Neraca.

Acceptance criteria:

- User bisa melihat daftar penyebab selisih atau potensi data rusak.

## P1 - MVP Bengkel

### P1.1 Flow antrian dan open bill

- [ ] Pastikan `frontend/components/BengkelForm.tsx` memakai label `Simpan Antrian`.
- [ ] Pastikan antrian bisa menyimpan item pre-order sparepart/service.
- [ ] Pastikan update order memodifikasi transaksi existing, bukan membuat baru.
- [ ] Gabungkan item sama di review order menjadi qty total.
- [ ] Pastikan field kendaraan hanya muncul saat guest/customer umum membutuhkannya.
- [ ] Pastikan kategori jual beli mobil tidak menampilkan informasi pelanggan umum yang tidak perlu.

Acceptance criteria:

- User bisa membuat antrian dan update open bill tanpa membuat transaksi keuangan.

### P1.2 Finalisasi dan pembayaran bengkel

- [ ] Tambahkan aksi `Selesaikan Pekerjaan`.
- [ ] Tambahkan opsi `Buat Tagihan` atau finalize tanpa bayar.
- [ ] Tambahkan opsi `Bayar Sekarang`.
- [ ] Pastikan bottom sheet pembayaran hanya muncul saat user memilih pembayaran.
- [ ] Tambahkan diskon di pembayaran.
- [ ] Pastikan setelah pembayaran lunas, status pengerjaan `SELESAI`.
- [ ] Pastikan pelunasan cicilan dari riwayat/rincian order tersedia.

Acceptance criteria:

- Flow lengkap: antrian -> update order -> selesai -> bayar/pelunasan.

### P1.3 Dokumen Bengkel

- [ ] Cetak Order Slip dari Buat Antrian Bengkel.
- [ ] Cetak Order Slip dari Rincian Order Riwayat.
- [ ] Pisahkan label Order Slip dan Receipt/Struk.
- [ ] Tampilkan tombol cetak sesuai status order.
- [ ] Pastikan Order Slip tidak dianggap bukti pembayaran.

Acceptance criteria:

- User bisa mencetak order operasional sebelum pembayaran, dan struk setelah lunas.

### P1.4 Rincian order dan riwayat

- [ ] Riwayat transaksi Bengkel edit/update mengarah ke `frontend/app/bengkel/transaksi/index.tsx`.
- [ ] Rincian Order menampilkan item, total, diskon, status kerja, status bayar.
- [ ] Rincian Order menampilkan histori pembayaran.
- [ ] Rincian Order menampilkan tombol pelunasan jika belum lunas.
- [ ] Rincian Order menampilkan tombol cetak sesuai status.

Acceptance criteria:

- Semua aksi utama bisa dilakukan dari riwayat/detail tanpa masuk form yang salah.

## P1 - MVP Laporan Keuangan

### P1.5 Neraca

- [ ] Pastikan `frontend/app/laporan/neraca.tsx` tidak menutupi selisih dengan angka paksa.
- [ ] Tampilkan status balance jelas.
- [ ] Tampilkan total aktiva, pasiva, dan selisih.
- [ ] Tampilkan panel rekomendasi jika ada selisih.
- [ ] Integrasikan hasil reconciliation jika endpoint sudah ada.

Acceptance criteria:

- Jika neraca selisih, user tahu ada data yang harus dicek.

### P1.6 Laba rugi dan perubahan modal

- [ ] Pastikan order bengkel `ANTRE/PROSES` tidak masuk laba rugi.
- [ ] Pastikan transaksi batal tidak masuk laba rugi.
- [ ] Pastikan laba rugi dan perubahan modal memakai rule laba/prive yang sama.
- [ ] Tambahkan test skenario kecil agar laba rugi konsisten dengan neraca.

Acceptance criteria:

- Laporan utama konsisten untuk skenario MVP.

## P1 - MVP Jual Beli Mobil

### P1.7 Penjualan dan pembayaran mobil

- [ ] Pastikan satu mobil hanya punya satu penjualan aktif.
- [ ] Pastikan penjualan belum lunas membuat piutang.
- [ ] Pastikan pelunasan mobil mengurangi piutang dan menambah kas.
- [ ] Pastikan status unit dan status bayar tampil terpisah.
- [ ] Pastikan internal bengkel mobil masuk histori biaya mobil.

Acceptance criteria:

- Mobil tidak bisa double sale dan pembayaran/cicilan bisa ditelusuri.

### P1.8 Investor

- [ ] Pastikan pencairan investor tercatat.
- [ ] Pastikan cancel sale setelah investor cair ditolak.
- [ ] Pastikan reversal investor tersedia sebelum cancel sale.
- [ ] Tampilkan status payout/reversal investor di frontend.

Acceptance criteria:

- Flow investor aman terhadap pembatalan transaksi.

## P1 - MVP Jasa Angkut

### P1.9 Basis piutang JA

- [ ] Tetapkan rule piutang JA secara eksplisit.
- [ ] Rekomendasi MVP: piutang customer eksternal memakai `harga_jual`.
- [ ] Update service JA agar rule tidak ambigu.
- [ ] Tambahkan test muatan belum bayar.
- [ ] Tambahkan test muatan lunas.

Acceptance criteria:

- Piutang JA punya nominal yang konsisten dengan invoice.

### P1.10 Biaya operasional JA

- [ ] Audit sumber biaya JA: biaya operasional, KasBank, pengeluaran manual.
- [ ] Pastikan biaya tidak double count.
- [ ] Pastikan repair bengkel JA hanya masuk finance saat selesai.
- [ ] Pastikan muatan batal tidak masuk laporan.
- [ ] Tambahkan test biaya operasional dan muatan batal.

Acceptance criteria:

- Laporan JA tidak menggandakan biaya atau revenue.

## P2 - Data Safety dan Audit Trail

### P2.1 Reversal ledger dasar

- [ ] Tambahkan kolom reversal di `KasBank`.
- [ ] Buat `LedgerReversalService`.
- [ ] Void transaksi final membuat reversal, bukan delete ledger.
- [ ] Tampilkan reversal di mutasi.
- [ ] Pastikan neraca balance setelah reversal.

Acceptance criteria:

- Mutasi lama tidak hilang saat transaksi final dibatalkan.

### P2.2 Idempotency payment

- [ ] Tambahkan `idempotency_key` pada endpoint payment utama.
- [ ] Reject payload berbeda dengan key sama.
- [ ] Return result sama untuk retry request yang sama.
- [ ] Terapkan minimal pada payment Bengkel dan Piutang.

Acceptance criteria:

- Double tap pembayaran tidak menggandakan kas.

### P2.3 Audit trail minimal

- [ ] Tambahkan `posted_at`, `posted_by`.
- [ ] Tambahkan `voided_at`, `voided_by`, `void_reason`.
- [ ] Tampilkan alasan batal/void di detail transaksi.
- [ ] Batasi void transaksi final untuk role yang sesuai.

Acceptance criteria:

- Perubahan transaksi final bisa ditelusuri user dan waktunya.

## P2 - UI/UX Operasional

### P2.4 Status dan aksi

- [ ] Pisahkan badge status kerja dan status bayar di Bengkel.
- [ ] Pisahkan status unit dan status bayar di Mobil.
- [ ] Pisahkan status muatan dan status bayar di JA.
- [ ] Gunakan label aksi sesuai konsekuensi bisnis.
- [ ] Hindari modal "Transaksi Berhasil" untuk antrian/open bill; gunakan "Order berhasil diupdate" atau sejenisnya.

Acceptance criteria:

- User tidak bingung antara antrian, invoice, pembayaran, dan struk.

### P2.5 Search dan filter

- [ ] Search customer inline, tidak perlu bottom sheet.
- [ ] Default tampilkan 10 customer.
- [ ] Tambahkan infinite loading.
- [ ] Tambahkan debounce search.
- [ ] Minimalisir filter pills di dashboard.

Acceptance criteria:

- Search dan filter lebih cepat dipakai untuk operasional harian.

### P2.6 Empty/loading/error state

- [ ] Tambahkan state kosong di Riwayat Bengkel.
- [ ] Tambahkan state kosong di Piutang/Hutang.
- [ ] Tambahkan retry pada error laporan.
- [ ] Pastikan loading tidak menggeser layout besar.

Acceptance criteria:

- UI tetap jelas saat data kosong, loading, atau gagal fetch.

## P3 - Refactor Lanjutan

### P3.1 Settlement service

- [ ] Buat struktur `backend/app/services/settlements/`.
- [ ] Pindahkan finance Bengkel ke `WorkshopSettlementService`.
- [ ] Pindahkan finance Mobil ke `CarSaleSettlementService`.
- [ ] Pindahkan finance JA ke `TransportSettlementService`.
- [ ] Pisahkan operational service dari settlement service.

Acceptance criteria:

- Service transaksi tidak lagi menanggung semua cabang finance.

### P3.2 Canonical finance classification

- [ ] Tambahkan field klasifikasi finance.
- [ ] Hindari laporan berbasis `keterangan ilike`.
- [ ] Buat source reference standard.
- [ ] Update laporan membaca klasifikasi baru.

Acceptance criteria:

- Laporan bisa ditelusuri tanpa bergantung pada teks keterangan.

### P3.3 Drilldown laporan

- [ ] Laba rugi bisa drilldown ke transaksi sumber.
- [ ] Neraca bisa drilldown ke kas/piutang/hutang/stok sumber.
- [ ] Perubahan modal bisa drilldown ke modal, laba, dan prive.

Acceptance criteria:

- Setiap angka laporan utama dapat ditelusuri.

## Urutan Eksekusi yang Disarankan

1. P0.1 Bengkel finance gate.
2. P0.2 Selesai belum bayar.
3. P0.3 Validasi nominal uang.
4. P0.4 Reconciliation read-only.
5. P1.1-P1.4 MVP Bengkel.
6. P1.5-P1.6 Laporan keuangan.
7. P2.1-P2.3 Data safety dasar.
8. P1.7-P1.8 Mobil.
9. P1.9-P1.10 Jasa Angkut.
10. P2.4-P2.6 UI/UX operasional.
11. P3 refactor lanjutan.

## Definition of Done per Task

Sebuah task dianggap selesai jika:

- Implementasi backend/frontend selesai sesuai scope.
- Test relevan ditambahkan atau verifikasi manual dicatat.
- Tidak menambah selisih neraca.
- Tidak membuat record finance Rp0.
- Status UI sesuai konsekuensi bisnis.
- Jika menyentuh finance/laporan, guardrail di `.agent/FINANCE_REPORTING_GUARDRAIL.md` tetap sesuai.
