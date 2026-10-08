---
tags: [tpm, aturan, finansial, dev-guidelines]
---

# TPM — Aturan Bisnis & Invariant Finansial

⬅️ [[CLAUDE|Kembali ke Hub]]

## ⚖️ Invariant Finansial (Critical — jangan dilanggar)

1. **Anti Rp0**: dilarang membuat jurnal kas/bank/piutang dengan nominal Rp0.
2. **Prinsip Double-Entry**: setiap mutasi kas masuk/keluar harus punya akun lawan seimbang. Total Aktiva (Aset/Kas/Piutang) = Total Pasiva (Kewajiban/Hutang + Modal + Laba Ditahan).
3. **Immutability Jurnal**: transaksi berjurnal **tidak boleh** `DELETE` fisik dari database. Kesalahan input/pembatalan wajib pakai **Reversal Transaction** (jurnal balik) untuk menihilkan efek nominal.
4. **Integrasi Kasir Mandiri (User Cash)**: setiap transaksi kasir wajib terikat sesi kas aktif (`user_cash`). Kasir tidak bisa bertransaksi sebelum buka kas awal, dan wajib rekonsiliasi (tutup kas) di akhir shift.

## 📊 Invariant Laporan & Import Saldo Awal

1. **Modal Awal = Aktiva − Hutang pada tanggal saldo awal** (anchor = tanggal impor `IMP-*` paling awal), dihitung sekali lalu beku di `system_settings.modal_awal_frozen`. Angka manual Rp2.242.611.225 hanya berlaku untuk anchor **2026-09-12**; import periode berikutnya selalu memakai nilai hitung.
2. **Filter non-impor wajib null-safe**: `nomor_referensi IS NULL OR nomor_referensi NOT LIKE 'IMP-%'`. `NOT LIKE` saja membuang baris ber-`nomor_referensi` NULL (mis. setoran modal manual).
3. **Setoran, prive, dan laba di Perubahan Modal = periode filter** (sama dengan Laba Rugi). Sisa kumulatif sejak anchor s/d sehari sebelum `tanggal_dari` tampil di *Laba Ditahan Sebelumnya* dan *Setoran Modal / Prive Bersih Sebelumnya* (`mutasi_modal_sebelumnya`), agar Modal Awal + mutasi = Modal Akhir.
4. **Baris "Penyesuaian Transaksi Backdate"** = penyeimbang transaksi non-impor bertanggal **sebelum** tanggal saldo awal (tidak tercakup Modal Awal beku maupun arus periode). Nilai bertanda (+ di Penambahan, − di Pengurangan) dan disertai daftar transaksinya (`backdate_detail`). Tanpa transaksi semacam itu nilainya harus 0 — selain itu audit.
5. **Import mobil mengisi `harga_beli_awal = harga_beli`.** Selisih keduanya = revaluasi stok (setoran non-kas); tanpa ini seluruh harga opening terbaca revaluasi.
6. **Persentase bagi hasil investor diisi manual per mobil setelah import** (template tidak punya kolom ini; default 0% = seluruh laba ke TPM).
7. **Koreksi data berbasis ID produksi tidak boleh jalan otomatis tanpa cek nama** — setelah reset + import ulang, ID menunjuk record lain. `heal_sparepart_stock_discrepancies` kini cek nama + sekali jalan (flag `heal_sparepart_stock_20260928_done`).
8. **Cek silang `/laporan/validate`**: laba Laba Rugi (`laba_operasional`, sebelum prive) dibandingkan dengan `info.laba_operasional` Perubahan Modal — bukan `laba_bersih` yang sudah dipotong prive.
9. **Guard anti-duplikat KasBank** (ber-`nomor_referensi`): kunci = jenis + tipe + nomor_referensi + referensi_id + tanggal + **nominal + keterangan**. DP lalu pelunasan mobil / cicilan di hari yang sama sah; hanya input ulang identik yang ditolak 409.
10. **`/validate` cek hutang**: hutang snapshot modal dikurangi `piutang_booking` dulu (Neraca menetting piutang booking ke piutang), agar booking DP tidak memunculkan MISMATCH palsu.
11. **Pembelian aset tetap** (Master Data → Aset → Pembelian Aset Tetap, seperti pembelian spare part) wajib memilih sumber dana: *Tunai Utama / Transfer* (Kas Keluar sumber `ASET`, bisa split; sisa yang belum dibayar jadi hutang ke supplier/penjual, `nomor_referensi` = kode aset), *Hutang Penuh*, atau *Setoran Pemilik* (setoran modal non-kas di Perubahan Modal). Hutang aset **bukan beban** Laba Rugi. Hapus aset = kas dibalik `[VOID]` + hutang belum dibayar ikut dihapus; ditolak bila hutangnya sudah dicicil. Aset tanpa `sumber_dana` (klien lama / import) tetap hanya terdaftar.
12. **Edit transaksi bengkel internal** (JB Mobil / Jasa Angkut) wajib menyamakan piutang & hutang internal ke `grand_total` baru (`_sync_internal_debts_nominal`); baris yang sudah LUNAS tetap lunas di nominal baru.
13. **Tes backend tidak boleh mematok angka/ID data produksi.** Tes laporan memakai saldo awal aktif s/d hari ini dan memeriksa invariant (balance, Modal Awal beku, kas = Σ mutasi, menu stok = Neraca). Wajib lulus di DB kosong, setelah import xlsx, dan setelah transaksi.
14. **Edit harga beli / stok spare part di Master Data wajib berjejak** (`_catat_penyesuaian_persediaan`): harga beli berubah (stok > 0) → `SparePartRevaluation` senilai (harga baru − harga lama) × stok lama; stok berubah → `SparePartRevaluation(is_qty_correction=True)` senilai Δqty × harga beli, tampil sebagai Koreksi Stok Opname (bukan Penyesuaian Backdate).
15. **Nilai persediaan historis** (Neraca tanggal lampau) = stok×harga sekarang − pembelian sesudah tanggal + pemakaian sesudah tanggal − **revaluasi & koreksi qty sesudah tanggal**. Tanpa dua suku terakhir persediaan lampau menggelembung dan Modal Awal beku ikut salah.
16. **Edit tanggal transaksi bengkel** memindahkan baris keuangan yang lahir bersamanya (kas pembayaran, piutang, pembayaran, hutang internal yang bertanggal sama dengan tanggal lama); cicilan belakangan tetap di tanggal aslinya.
17. **Harga jual di nota boleh diubah** (override harga master): pendapatan = harga nota. HPP memakai harga beli terakhir, sama dengan nilai persediaan, jadi penjualan tidak memunculkan selisih harga lagi.
18. **Persediaan spare part dinilai harga beli terbaru (stok × harga beli)**, sama persis dengan daftar stok. Selisih harga stok lama saat harga beli berubah (pembelian dengan harga baru atau edit Master Data) **langsung** diakui di *Penyesuaian Harga Beli Spare Part* (positif = laba, negatif = rugi) di Perubahan Modal dan bagian Modal Neraca — tidak menunggu terjual, bukan baris Laba Rugi. *Koreksi Stok Opname* = Σ Δqty × harga beli. Keduanya ikut dijumlah di Perubahan Bersih Modal (app, PDF, dashboard) sehingga Modal Awal + aliran = Modal Akhir.
19. **Tanggal transaksi tidak boleh melewati hari ini (WIB).** Schema input (piutang, hutang, pembayaran, pengeluaran, pembelian part, nota bengkel, muatan, kasbon, mobil, aset) menolak 422 dan `KasBankService.create` menolak 400 (ikut transfer & penyesuaian saldo). Kas bertanggal besok tidak terhitung di Neraca/Kas hari ini → saldo sistem diam-diam beda dengan real. Frontend wajib memakai tanggal lokal `getTodayString()`, **bukan** `toISOString()` (UTC, mundur sehari sebelum 07:00 WIB). Baris lama dikoreksi dengan `backend/scripts/fix_tanggal_masa_depan.py`.
20. **Tidak ada lagi revaluasi "belum terealisasi".** Tabel `spare_part_revaluation_release` masih terisi saat penjualan tetapi tidak dipakai laporan (sejak 6 Okt 2026).
21. **Setoran modal sebelum saldo awal tetap terlihat sebagai Penambahan Modal.** Setoran MODAL non-impor bertanggal < anchor sudah ada di Modal Awal beku (snapshot Neraca anchor). Porsinya dikeluarkan dari Modal Awal tampilan (`modal_awal − setoran_pra_anchor`) dan diakui sebagai setoran: jatuh di periode filter → *Penambahan Modal*, sisanya → *Setoran Modal Bersih Sebelumnya*. Modal Akhir tidak berubah. Setoran MODAL tidak didaftar lagi di `backdate_detail`. Catatan: setoran pra-anchor yang dibuat *setelah* Modal Awal beku diambil tetap jatuh ke Penyesuaian Backdate (tidak dipotong dari Modal Awal).
22. **Refund DP pembatalan booking JB Mobil** punya dua mode. `HUTANG` (default): sisa DP jadi hutang `UANG_MUKA_PENJUALAN`, kas tidak berubah, dilunasi dari menu Hutang. `LANGSUNG`: kas KELUAR per baris metode/kas pilihan, total baris wajib = sisa DP (DP − penalti), tanpa hutang baru. Refund langsung + penalti = DP terbayar. Pembatalan penjualan LUNAS (`cancel-sale`) punya mode yang sama: `LANGSUNG` membalik seluruh uang masuk pembeli dari kas pilihan; `HUTANG` tidak menyentuh kas dan mencatat sisa uang diterima (masuk − keluar) sebagai hutang `UANG_MUKA_PENJUALAN`.
23. **Hutang gaji karyawan (akrual absensi).** Absensi HADIR / SETENGAH_HARI bertanggal ≥ **12 Okt 2026** diakui saat diisi: Dr Beban Gaji / Cr Hutang Gaji (`gaji_akrual_service`). Nilai harian = gaji_pokok / 6 × faktor (1 / 0.5), dibulatkan per baris. Slip periode ≥ cutoff memakai gaji_pokok = jumlah akrual absensi periode itu, dan jumlah hadir tidak boleh di-override. Saat slip cair, gaji_pokok mengurangi hutang gaji (bukan beban lagi); kas dan kasbon seperti biasa; lembur tetap beban saat cair. Absensi yang tanggalnya sudah tercakup slip (apa pun statusnya) tidak bisa diubah atau dihapus; hapus slip yang belum cair dulu. Periode sebelum cutoff tidak berubah.

## 📝 Aturan Pengembangan (Dev Guidelines)

1. **Business Logic Isolation**: dilarang keras query DB, manipulasi model finansial, atau kalkulasi harga langsung di route controller (`api/v1/endpoints/`). Wajib dibungkus di service class (`app/services/`).
2. **Schema Validation**: semua data masuk dari frontend wajib divalidasi Pydantic v2 (`app/schemas/`) sebelum diproses ORM.
3. **Database Changes**: semua perubahan kolom/tabel/index wajib lewat migrasi Alembic baru:
   ```bash
   alembic revision --autogenerate -m "deskripsi_perubahan"
   alembic upgrade head
   ```
4. **Immutability Pattern (Frontend Store)**: dilarang mutasi state Zustand langsung — gunakan dispatcher yang mengembalikan salinan state baru (immutable), sesuai `coding-style.md`.
5. **Code-first Models**: SQLAlchemy 2.x `Mapped`/`mapped_column`. Semua skema di `app/models/` — enum baru wajib ditambahkan ke `app/utils/constants.py` agar tercakup migrasi autogenerate.

## Guardrail Tambahan Khusus Finance/Laporan

> Sumber: `RTK.md` (aturan operasional untuk AI coding agent di repo ini — lihat [[TPM - Agent Workflow (RTK-Codex)]])

- Flow keuangan & laporan keuangan dianggap **baseline stabil** — hati-hati mengubahnya.
- Setiap perubahan yang menyentuh `finance`, `laporan`, `kas_bank`, `piutang`, `hutang`, `neraca`, `laba_rugi`, atau `perubahan_modal` **wajib** diverifikasi end-to-end:
  - cek dampak UI
  - cek source data / service
  - cek konsistensi laporan
  - jalankan typecheck / test relevan
- Setiap perubahan finance/laporan wajib dicatat di dokumentasi alur keuangan **sebelum** dianggap selesai.
- Dokumen acuan: [[TPM - Aturan Bisnis & Invariant]] & [[CLAUDE]].

⬅️ [[CLAUDE|Kembali ke Hub]]
