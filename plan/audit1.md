# Audit 1 - Proses Bisnis dan Risiko Aplikasi TPM

Tanggal audit: 2026-06-05

Scope audit awal:

- Flow bisnis Bengkel, Jual Beli Mobil, Jasa Angkut, Keuangan, SDM.
- Risiko bug finansial dan laporan.
- Risiko backend/service/API.
- Risiko UI/UX dan operasional user.
- Rekomendasi prioritas perbaikan.

Dokumen ini bukan hasil audit akuntansi final. Ini adalah audit teknis dan proses bisnis berdasarkan struktur repo, service backend, screen frontend, dan guardrail finansial yang ada.

## Ringkasan Eksekutif

Aplikasi TPM sudah punya pondasi modul yang lengkap: transaksi bengkel, jual beli mobil, jasa angkut, kas/bank, piutang, hutang, laporan, SDM, dan master data. Risiko terbesar bukan pada kurangnya fitur, tetapi pada konsistensi antar modul ketika satu transaksi menyentuh beberapa domain sekaligus.

Area paling berisiko:

1. **Finance gate Bengkel.** Antrian/proses bengkel harus tetap operasional, bukan finansial. Bug Rp0 di keuangan sudah pernah muncul, jadi rule ini wajib dijadikan invariant backend dan test.
2. **Internal transaction antar unit.** Bengkel untuk jual beli mobil dan jasa angkut membuat efek ganda: stok part berkurang, biaya unit naik, piutang/hutang internal, kas unit, laba bengkel, HPP mobil/JA. Ini rentan double count.
3. **Laporan konsolidasi.** Neraca/laba rugi sudah memakai banyak koreksi dan eliminasi internal. Semakin banyak patch khusus, semakin tinggi risiko laporan seimbang secara angka tetapi salah secara sumber.
4. **Update transaksi open bill.** Saat transaksi bengkel diupdate, detail lama, stok, kas, piutang, dan histori unit bisa berubah. Jika tidak atomic dan tidak punya audit trail, data historis mudah rusak.
5. **UI pembayaran dan status.** User bisa bingung antara "update order", "selesai pekerjaan", "lanjut pembayaran", "belum lunas", dan "piutang". Ini dapat membuat transaksi masuk status yang tidak sesuai bisnis.

Rekomendasi utama:

- Jadikan status operasional dan status finansial sebagai dua state machine terpisah.
- Semua service finansial harus idempotent dan punya reversal, bukan delete langsung.
- Buat test integrasi minimal untuk Bengkel, Mobil, JA, Piutang, Hutang, KasBank, Laba Rugi, Neraca.
- Pisahkan dokumen "source of truth laporan" dari logika service yang penuh koreksi.
- Tambahkan audit log untuk mutasi transaksi yang sudah punya dampak finansial.

## Peta Modul dan Alur Utama

### Bengkel

Modul terkait:

- Frontend: `frontend/components/BengkelForm.tsx`, `frontend/app/bengkel/index.tsx`, `frontend/app/bengkel/transaksi/index.tsx`.
- Service API: `frontend/services/bengkel.ts`.
- Backend: `backend/app/api/v1/transaksi_bengkel.py`, `backend/app/services/transaksi_bengkel_service.py`.
- Model: `backend/app/models/bengkel.py`.

Flow bisnis saat ini:

1. User membuat antrian bengkel.
2. Antrian bisa punya item pre-order service/sparepart.
3. Order slip bisa dicetak.
4. User membuka transaksi bengkel untuk update order/open bill.
5. User bisa simpan update tanpa pembayaran.
6. User bisa lanjut pembayaran.
7. Setelah pembayaran, status pengerjaan menjadi selesai.
8. Riwayat order dapat dipakai untuk melihat rincian dan pelunasan.

Invarian penting:

- `ANTRE` dan `PROSES` tidak boleh membuat record kas/bank, piutang, hutang, laba, HPP, atau pendapatan.
- Stok sparepart untuk order open bill perlu keputusan bisnis yang jelas: apakah stok dikurangi saat order dibuat, saat proses, atau saat selesai.
- Jika order selesai tetapi belum bayar, harus ada piutang yang benar atau status "selesai belum ditagih" yang eksplisit.

Risiko:

- Service create/update bengkel masih memuat banyak cabang: umum, jasa_angkut, jual_beli_mobil, lunas, cicilan, internal, split payment. Semakin banyak cabang di satu method, semakin sulit memastikan semua kombinasi aman.
- Update transaksi menghapus ulang detail lama dan mengembalikan stok. Jika ada pembayaran/piutang/kas yang sudah terbentuk, risiko data historis hilang atau saldo berubah tanpa jejak.
- Jika stok dikurangi pada antrian, stok fisik bisa terkunci walaupun pekerjaan belum jadi. Jika order dibatalkan, restore stok wajib selalu benar.
- Jika transaksi selesai tanpa pembayaran tetapi tidak membuat piutang, laporan laba/neraca bisa selisih.

Rekomendasi:

- Buat state machine Bengkel:
  - Operational: `ANTRE`, `PROSES`, `SELESAI`, `BATAL`.
  - Financial: `DRAFT`, `UNBILLED`, `INVOICED`, `PARTIAL`, `PAID`, `VOID`.
- Gunakan service khusus `WorkshopFinanceService.finalize_order()` untuk satu pintu pencatatan kas/piutang/HPP.
- Untuk update order yang belum final, boleh replace detail.
- Untuk order yang sudah final finansial, gunakan adjustment/reversal, bukan delete detail dan delete kas.
- Tambahkan test:
  - Create antrian tanpa item: tidak ada kas/piutang/hutang.
  - Create antrian dengan item: tidak ada kas/piutang/hutang sampai selesai/final.
  - Update item yang sama: qty tergabung dan stok benar.
  - Bayar lunas: kas masuk, status selesai, laporan masuk.
  - Selesai belum bayar: piutang naik, kas tidak naik, neraca seimbang.
  - Batal order: stok kembali dan tidak ada sisa finansial aktif.

### Jual Beli Mobil

Modul terkait:

- Frontend: `frontend/app/mobil/index.tsx`, `frontend/components/MobilForm.tsx`, `frontend/components/MobilCostForm.tsx`.
- Service API: `frontend/services/mobil.ts`.
- Backend: `backend/app/api/v1/mobil.py`, `backend/app/api/v1/penjualan_mobil.py`, `backend/app/services/mobil_service.py`, `backend/app/services/penjualan_mobil_service.py`.
- Model: `backend/app/models/mobil.py`.

Flow bisnis:

1. Unit mobil masuk stok.
2. Biaya pembelian dan biaya persiapan menambah modal/HPP.
3. Internal bengkel untuk mobil dapat menambah biaya part/service ke unit.
4. Penjualan mobil menghitung laba, investor share, piutang/pembayaran.
5. Jika investor ada, pencairan investor harus dikelola dan reversal harus eksplisit.

Risiko:

- Internal bengkel untuk mobil bisa dihitung sebagai laba bengkel sekaligus menambah HPP mobil. Ini benar hanya jika eliminasi internal di laporan konsolidasi konsisten.
- Penjualan mobil memakai konsep booking/cicilan/lunas. Jika mobil status `BOOKING` tetapi ada DP, perlu piutang/uang muka yang jelas.
- Cancel sale investor berisiko jika pencairan investor sudah terjadi. Guardrail sudah menyebut reversal eksplisit, tetapi perlu test.
- Ada dua sumber biaya mobil: `MobilBiayaLainnya` dan transaksi bengkel internal. Risiko double count di laporan tinggi.

Rekomendasi:

- Buat ledger biaya mobil yang canonical: pembelian unit, biaya persiapan, internal bengkel, biaya penjualan, adjustment.
- Tiap biaya mobil wajib punya `source_type`, `source_id`, dan aturan apakah masuk HPP, expense periode, atau internal eliminasi.
- Investor flow harus punya state: `not_disbursed`, `disbursed`, `reversed`.
- Test wajib:
  - Mobil TPM dijual lunas.
  - Mobil investor dijual lunas lalu pencairan investor.
  - Cancel sale sebelum pencairan.
  - Cancel sale setelah pencairan harus ditolak sampai reversal.
  - Internal bengkel mobil belum terjual tidak menaikkan laba konsolidasi secara salah.

### Jasa Angkut

Modul terkait:

- Frontend: `frontend/app/jasa-angkut/*`, `frontend/services/jasaAngkut.ts`.
- Backend: `backend/app/api/v1/muatan.py`, `backend/app/services/muatan_service.py`.
- Model: `backend/app/models/jasa_angkut.py`.

Flow bisnis:

1. User membuat muatan dengan armada, supir, asal, tujuan, harga beli, harga jual.
2. Sistem menghitung pendapatan kotor dan share TPM/supir.
3. Biaya operasional perjalanan dicatat sebagai biaya armada/unit.
4. Bengkel internal untuk JA dapat menjadi biaya repair/maintenance.
5. Pembayaran/piutang mempengaruhi kas dan laporan JA.

Risiko:

- Piutang JA perlu dipastikan basis nominalnya: apakah `harga_jual`, `pendapatan_kotor`, atau share TPM. Komentar di service menunjukkan area ini pernah ambigu.
- Biaya operasional JA bisa muncul di `JasaAngkutBiayaLainnya`, `KasBank`, dan `PengeluaranBengkel`. Risiko double deduction tinggi.
- Muatan internal harus tidak dianggap pendapatan eksternal. Jika hanya dibedakan label/kategori di UI, backend masih rentan salah catat.
- Status muatan `PROSES/SELESAI/BATAL` dan status bayar harus punya dampak laporan yang jelas.

Rekomendasi:

- Tetapkan definisi akuntansi JA:
  - Revenue eksternal: harga jual atau margin?
  - HPP/biaya langsung: harga beli atau biaya operasional?
  - Share supir: hutang ke supir atau beban langsung?
- Buat satu table/source canonical untuk biaya perjalanan.
- Tambahkan flag `is_internal` untuk muatan internal dan filter laporan.
- Test:
  - Muatan belum bayar membuat piutang dengan nominal yang disepakati.
  - Muatan dibayar split membuat kas sesuai sumber.
  - Biaya BBM/tol tidak terhitung dua kali.
  - Bengkel internal JA tidak menaikkan revenue konsolidasi tanpa eliminasi.

### Keuangan

Modul terkait:

- Frontend: `frontend/app/finance/*`, `frontend/services/keuangan.ts`.
- Backend: `backend/app/api/v1/kas_bank.py`, `piutang.py`, `hutang.py`, `pengeluaran.py`.
- Services: `kas_bank_service.py`, `kas_bank_integration.py`, `piutang_service.py`, `hutang_service.py`, `pengeluaran_service.py`.
- Reports: `backend/app/services/reports/*`.

Flow bisnis:

1. Modul transaksi membuat efek finansial melalui kas/bank, piutang, hutang, atau modal.
2. KasBank menjadi ledger kas/bank.
3. Piutang dan hutang punya pembayaran terpisah.
4. Laporan membaca data agregat dari service transaksi dan ledger.

Risiko:

- `create_kas_entry()` memetakan metode bayar ke kas jenis. Transfer masuk ke `BANK_UTAMA`, tunai/internal masuk kas unit. Jika UI mengirim metode yang tidak konsisten, saldo masuk akun yang salah.
- Ada banyak enum sumber (`BENGKEL`, `JASA_ANGKUT`, `JUAL_BELI_MOBIL`, `PIUTANG`, `HUTANG`, `MODAL`, dll). Salah sumber akan membuat laporan unit salah.
- Manual kas/bank bisa membuat transaksi yang tidak punya pasangan di piutang/hutang/pengeluaran.
- Delete atau update transaksi finansial tanpa reversal menghilangkan audit trail.
- `allow_negative=True` dipakai untuk beberapa internal/operasional. Ini praktis, tapi bisa menyembunyikan kas unit minus yang seharusnya diproses sebagai transfer/modal unit.

Rekomendasi:

- Terapkan immutable ledger untuk KasBank: koreksi memakai reversal entry, bukan delete.
- Tambahkan `source_type`, `source_id`, `source_ref`, `is_reversal`, `reversal_of_id`.
- Validasi backend: transaksi finansial nominal harus `> 0`.
- Buat endpoint reconciliation:
  - KasBank vs Piutang payment.
  - KasBank vs Hutang payment.
  - KasBank vs Pengeluaran.
  - Internal transfer pair MASUK/KELUAR.
- Batasi manual ledger untuk role tertentu dan wajib catatan.

## Audit Laporan

### Laba Rugi

Risiko utama:

- Laba rugi memakai banyak sumber: summary bengkel, summary mobil, summary muatan, pengeluaran, payroll, ledger kas.
- Internal transaction harus dieliminasi agar laba konsolidasi tidak overstated.
- Jika bengkel internal mobil diakui sebagai laba bengkel, mobil belum terjual bisa membuat laba konsolidasi naik sebelum realisasi eksternal.
- Prive dan biaya admin ada fallback scan dari KasBank berdasarkan keterangan. Ini rentan karena bergantung pada teks.

Rekomendasi:

- Hindari logika laporan berbasis `keterangan ilike`.
- Buat klasifikasi transaksi yang eksplisit: `capital`, `revenue`, `cogs`, `expense`, `receivable`, `payable`, `equity`, `internal`.
- Semua laporan mengambil dari klasifikasi tersebut.
- Tambahkan test snapshot laba rugi untuk skenario kecil yang deterministik.

### Neraca

Risiko utama:

- Neraca sudah memakai bottom-up equity dan identity cross-validation. Ini bagus untuk mendeteksi selisih, tetapi juga menunjukkan data sumber belum sepenuhnya canonical.
- Modal non-kas auto-balancing dapat menutupi masalah historis jika tidak diberi audit trail.
- Piutang/hutang internal dikecualikan dari konsolidasi. Jika flag internal salah, neraca bisa selisih atau double count.
- Selesai belum bayar pada bengkel harus menjadi piutang; jika tidak, laba ditahan naik tanpa aktiva yang setara.

Rekomendasi:

- Jangan pakai auto-balancing sebagai perbaikan diam-diam. Tampilkan sebagai "modal/import adjustment" dengan sumber jelas.
- Buat rekonsiliasi harian:
  - total aktiva
  - total pasiva
  - selisih
  - daftar transaksi penyebab selisih
- Tambahkan test neraca:
  - modal awal 10 juta.
  - bengkel selesai belum bayar 50 ribu: piutang +50 ribu, laba +? sesuai accrual, neraca balance.
  - bengkel antre 50 ribu: tidak mengubah neraca/laba.
  - pembayaran piutang: kas naik, piutang turun, total aktiva tetap.

### Perubahan Modal

Risiko utama:

- Perubahan modal harus konsisten dengan laba rugi dan neraca.
- Prive bisa berasal dari pengeluaran atau kas keluar manual. Jika klasifikasi tidak eksplisit, laporan mudah beda.
- Investor disbursement tidak boleh dianggap prive/modal TPM.

Rekomendasi:

- Perubahan modal hanya membaca:
  - setoran modal
  - laba bersih konsolidasi
  - prive owner
  - adjustment modal yang eksplisit
- Investor payout dipisahkan dari prive.

## Audit Backend

### Service Layer

Temuan:

- Business logic utama sudah berada di service, ini pola yang benar.
- Beberapa service terlalu besar dan memuat banyak tanggung jawab dalam satu method.
- Transaksi finansial dan transaksi operasional sering diproses di method yang sama.

Risiko:

- Sulit membuat test per rule bisnis.
- Perubahan UI kecil bisa memicu bug finansial karena payload bercabang.
- Commit sebagian bisa terjadi jika method melakukan beberapa commit berurutan.

Rekomendasi:

- Pisahkan service:
  - `WorkshopOrderService`
  - `WorkshopFinanceService`
  - `InternalRepairSettlementService`
  - `ReportReconciliationService`
- Gunakan satu database transaction per operasi bisnis.
- Hindari multiple `commit()` dalam satu flow panjang. Pakai `flush()` lalu commit di akhir.
- Tambahkan domain event internal setelah commit berhasil.

### API dan Schema

Risiko:

- Payload frontend dapat membawa field yang tidak relevan untuk kategori tertentu.
- Validasi beberapa rule bisnis tampak ada di frontend dan backend, tetapi backend harus menjadi sumber final.
- Status string/enum harus konsisten antara frontend dan backend.

Rekomendasi:

- Buat schema terpisah:
  - `WorkshopQueueCreate`
  - `WorkshopOrderUpdate`
  - `WorkshopPaymentCreate`
  - `InternalRepairCreate`
- Validasi kategori:
  - `umum`: customer boleh master/guest, kendaraan wajib untuk guest.
  - `jual_beli_mobil`: customer umum tidak perlu, mobil wajib.
  - `jasa_angkut`: muatan/armada wajib sesuai flow.
- Reject nominal pembayaran/diskon negatif atau format invalid di backend.

### Data Integrity

Risiko:

- Nomor transaksi dibuat dari query last number. Jika ada concurrent request, duplicate number bisa terjadi.
- Soft delete dan recycle bin harus dipastikan tidak ikut laporan.
- Stok sparepart rentan race condition saat dua transaksi memakai part yang sama.

Rekomendasi:

- Tambahkan unique constraint untuk nomor transaksi/piutang/hutang.
- Gunakan lock atau atomic update untuk stok.
- Semua query laporan wajib filter `deleted_at is null` bila model mendukung soft delete.

## Audit UI/UX

### Bengkel

Risiko UX:

- User bisa tidak paham beda "Buat Antrian", "Update Transaksi", "Lanjut Pembayaran", dan "Pelunasan".
- Filter dashboard sebelumnya terlalu banyak pills; sudah ada redesign, tetapi tetap perlu validasi usability.
- Rincian order dari riwayat harus menampilkan aksi yang sesuai status:
  - Antre/Proses: update order, cetak order slip.
  - Selesai belum bayar: bayar/pelunasan.
  - Lunas: cetak struk.
  - Batal: hanya detail.

Rekomendasi UI:

- Gunakan label:
  - "Buat Antrian" untuk draft operational.
  - "Update Order" untuk open bill.
  - "Selesaikan & Tagih" untuk final tanpa pembayaran langsung.
  - "Bayar Sekarang" untuk cash settlement.
- Tampilkan badge terpisah:
  - Status Kerja: Antre/Proses/Selesai/Batal.
  - Status Bayar: Belum Ditagih/Belum Bayar/Cicilan/Lunas.
- Pada review order, group item sama dan tampilkan qty total.
- Pada field Rupiah, default state kosong atau `Rp 0` harus konsisten di seluruh form.

### Keuangan dan Laporan

Risiko UX:

- Jika laporan selisih, user hanya melihat angka selisih tanpa tahu transaksi penyebab.
- Mutasi kas/bank manual dapat membingungkan jika tidak jelas sumber dan pasangan transaksi.
- Piutang/hutang unit perlu filter yang mudah dipahami.

Rekomendasi UI:

- Pada neraca, tambahkan panel "Diagnosa Selisih" yang membuka daftar sumber mismatch.
- Pada mutasi, tampilkan `source`, `reference`, dan link ke transaksi asal.
- Pada piutang/hutang, tampilkan unit, sumber, nomor referensi, dan status internal/eksternal.

## Risiko Bug Dikemudian Hari

### Critical

1. **Double count internal bengkel mobil/JA.**
   - Dampak: laba, HPP, stok, piutang/hutang, dan neraca salah.
   - Pencegahan: klasifikasi internal dan eliminasi test.

2. **Order bengkel belum final masuk laporan.**
   - Dampak: keuangan muncul Rp0 atau laba/piutang prematur.
   - Pencegahan: filter `status_pengerjaan = SELESAI` di semua report finance dan dashboard finance.

3. **Update transaksi final menghapus ledger.**
   - Dampak: audit trail hilang, saldo berubah tanpa histori.
   - Pencegahan: reversal entry dan adjustment.

4. **Selesai belum bayar tidak jadi piutang.**
   - Dampak: neraca selisih karena laba naik tanpa aktiva.
   - Pencegahan: finalisasi selesai belum bayar wajib create piutang.

5. **Piutang JA salah nominal.**
   - Dampak: AR dan revenue tidak sesuai invoice.
   - Pencegahan: keputusan bisnis eksplisit dan test.

### High

1. **Kas unit minus karena `allow_negative=True`.**
   - Dampak: kas unit tidak realistis.
   - Pencegahan: transfer kas/modal unit sebelum biaya, atau alert saldo minus.

2. **Race condition stok sparepart.**
   - Dampak: stok negatif atau stok tidak sesuai fisik.
   - Pencegahan: atomic stock update dan lock.

3. **Nomor transaksi duplicate saat concurrent request.**
   - Dampak: referensi laporan dan receipt ambigu.
   - Pencegahan: unique constraint dan retry generator.

4. **Manual ledger tanpa sumber canonical.**
   - Dampak: laporan sulit direkonsiliasi.
   - Pencegahan: klasifikasi wajib dan role permission.

5. **Enum frontend/backend tidak sinkron.**
   - Dampak: status filter salah dan API reject.
   - Pencegahan: generate types atau shared enum contract.

### Medium

1. **UX status terlalu mirip.**
   - Dampak: user salah klik bayar/update.
   - Pencegahan: label aksi berdasarkan status.

2. **Receipt/order slip tidak sesuai status.**
   - Dampak: customer menerima dokumen yang salah.
   - Pencegahan: template berbeda untuk order slip vs invoice vs receipt.

3. **Search customer infinite loading boros query.**
   - Dampak: UI lambat.
   - Pencegahan: debounce, pagination, cache.

4. **Laporan berbasis tanggal tanpa timezone konsisten.**
   - Dampak: transaksi malam masuk tanggal berbeda.
   - Pencegahan: semua tanggal bisnis memakai Asia/Jakarta.

## Rekomendasi Roadmap Perbaikan

### Fase 1 - Guardrail dan Test Minimum

- Tambahkan test integrasi Bengkel:
  - antre tanpa finance
  - proses tanpa finance
  - selesai belum bayar jadi piutang
  - lunas jadi kas
  - batal restore stok
- Tambahkan test laporan:
  - neraca balance untuk skenario kecil
  - laba rugi tidak mengakui antre/proses
- Tambahkan validasi backend nominal `> 0` untuk semua payment/discount sesuai rule.
- Tambahkan unique constraint nomor transaksi/piutang/hutang.

### Fase 2 - Refactor Finance Flow

- Pisahkan operational order dan financial settlement.
- Buat reversal system untuk KasBank, Piutang, Hutang.
- Tambahkan audit log untuk update transaksi final.
- Standarkan klasifikasi transaksi finansial.

### Fase 3 - Reconciliation Tools

- Buat endpoint `GET /laporan/reconciliation`.
- Tampilkan penyebab selisih neraca.
- Tampilkan unmatched ledger:
  - kas tanpa source transaksi
  - piutang tanpa referensi
  - hutang tanpa referensi
  - internal transfer tidak punya pair

### Fase 4 - UX Hardening

- Redesign action berdasarkan status.
- Tambahkan empty/error/loading state konsisten di finance dan laporan.
- Tambahkan link dari mutasi/piutang/hutang ke transaksi asal.
- Pisahkan Order Slip, Invoice, dan Receipt secara jelas.

## Checklist Audit Lanjutan

- [ ] Audit semua endpoint yang membuat `KasBank`.
- [ ] Audit semua endpoint yang membuat `PiutangUsaha`.
- [ ] Audit semua endpoint yang membuat `HutangUsaha`.
- [ ] Audit semua query laporan agar filter status final konsisten.
- [ ] Audit semua flow cancel/void agar memakai reversal.
- [ ] Audit semua field uang di frontend agar format dan parse Rupiah konsisten.
- [ ] Audit semua status enum frontend/backend.
- [ ] Audit soft delete pada laporan.
- [ ] Audit realtime invalidation untuk modul finance/laporan.
- [ ] Audit permission role untuk transaksi manual dan laporan.

## Kesimpulan

Prioritas teknis TPM berikutnya sebaiknya bukan menambah fitur baru, tetapi menguatkan konsistensi transaksi. Aplikasi sudah berada di titik dimana satu klik user bisa mengubah banyak sumber data sekaligus. Tanpa state machine, idempotent settlement, reversal, dan test laporan, bug yang muncul ke depan kemungkinan besar berupa selisih neraca, laba ganda, stok tidak cocok, atau status transaksi yang ambigu.

Target kualitas yang disarankan:

- Order operasional tidak otomatis menjadi transaksi finansial.
- Setiap transaksi finansial punya sumber, referensi, dan reversal.
- Setiap laporan dapat ditelusuri sampai transaksi asal.
- Setiap status di UI menjelaskan kondisi kerja dan kondisi bayar secara terpisah.
- Setiap perubahan finansial punya test minimal yang memeriksa kas, piutang/hutang, laba rugi, dan neraca.
