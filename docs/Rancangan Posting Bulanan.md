# Rancangan Posting Bulanan (Draft, belum diimplementasi)

Status: DIIMPLEMENTASI (opsi B, nota tambahan). Lihat invariant 42 di `TPM - Aturan Bisnis & Invariant.md` dan bagian Posting Bulanan di `TPM - Catatan Revisi.md`. Sesuai guardrail finance, setelah diimplementasi perilaku baru wajib dicatat di `TPM - Aturan Bisnis & Invariant.md` dan `TPM - Catatan Revisi.md`.

## 1. Tujuan
- Laporan bulan yang sudah diposting tidak berubah lagi.
- Item yang diinput setelah bulan diposting masuk ke bulan terbuka berikutnya (perilaku Excel: baris diketik di bulan N masuk laporan bulan N).
- Laporan aplikasi November sama dengan Excel (laba kotor bengkel Rp30.627.342 setelah 114 baris nota Oktober dipindah ke November).

## 2. Temuan dari kode (kenapa tidak bisa sekadar menambah kolom di baris)
1. `TransaksiBengkelService.update()` menghapus SEMUA baris part dan jasa lalu membuat ulang (baris 1037+). Kolom periode di baris akan hilang atau berubah ke bulan edit pada tiap edit, kecuali ada pencocokan baris lama dan baru.
2. Total nota (`grand_total`, `hpp_parts`, `laba_kotor`, `total_parts`, `total_jasa`) tersimpan di header dan dipakai oleh hampir semua laporan. Filter periode memakai `TransaksiPenjualanBengkel.tanggal` di sekitar 30 titik:
   - `reports/base.py` (8 titik), `reports/neraca_service.py`, `reports/laba_rugi_service.py`, `reports/modal_service.py` (2)
   - `muatan_service.py` (4), `penjualan_mobil_service.py` (4), `mobil_service.py`, `armada_service.py`
   - `transaksi_bengkel_service.py` (ringkasan, laporan diskon, daftar, dll.)
3. Nota INTERNAL membentuk piutang/hutang internal dan stok mobil per nota (`sync_internal_transactions`), jadi memecah pengakuan per baris juga harus memecah tiga hal itu.
4. Simulasi (salinan DB, 7 nota Oktober dipindah ke November): laba kotor Rp6.669.833 pindah, Neraca 31 Okt berubah di persediaan (+41,19 jt), stok mobil dan hutang internal (−47,11 jt), piutang usaha (−0,75 jt). Neraca 30 Nov tidak berubah. Neraca tetap seimbang.

## 3. Opsi
### A. Periode posting per baris
- Kolom `periode_posting` di `detail_transaksi_spare_parts` dan `detail_transaksi_services`.
- Semua laporan dihitung dari baris, bukan header, termasuk alokasi diskon, internal hutang/stok mobil, JA, mobil.
- Risiko tinggi: ±30 titik laporan berubah, `update()` perlu mencocokkan baris lama dan baru.

### B. Nota tambahan (disarankan)
- Tabel `periode_posting` (tahun, bulan, status TERBUKA/DIPOSTING, diposting_pada, diposting_oleh, catatan_buka).
- Nota tetap satu unit pengakuan dengan `tanggal` seperti sekarang. Semua query laporan TIDAK diubah.
- Kunci: edit nota yang tanggalnya di periode DIPOSTING:
  1. Penambahan item dibuat sebagai NOTA TAMBAHAN baru di periode terbuka (nomor baru, `induk_nomor` mengacu nota asal, kategori/plat/mobil/armada sama, status internal sama). Stok, HPP, hutang/piutang internal, stok mobil mengikuti alur nota biasa.
  2. Perubahan atau penghapusan baris lama di periode DIPOSTING ditolak, kecuali periode dibuka kembali (admin, dengan alasan).
  3. Pembayaran/cicilan tetap di tanggal pembayaran seperti sekarang.
- Laporan bulan DIPOSTING tidak bisa bergeser karena nota di dalamnya tidak bisa diubah lagi.

## 4. Rekomendasi
Opsi B. Hasil akhirnya sama dengan Excel, tetapi memakai alur nota yang sudah teruji. Perubahan terkonsentrasi di satu service, bukan di laporan.

## 5. Data lama (Oktober)
Skrip dengan dry-run bawaan:
1. Untuk 7 nota Oktober (BGL2610060004, BGL2610060005, BGL2610110001, BGL2610240004, BGL2610270003, BGL2610270006, BGL2610290003), pindahkan 114 baris yang ada di Excel November ke nota tambahan bertanggal sesuai kolom TGL Excel. Stok tidak berubah (baris dipindah, bukan dijual ulang).
2. Rp30,1 juta sisanya tetap di Oktober dan ditandai untuk dicek (tidak ada tanggal posting).
3. Hasil dibandingkan dengan Excel: laba kotor November Rp30.627.342, laba operasional selisih Rp199.668 (lembur minggu 4).
4. Setelah itu Oktober diposting.

## 6. Uji yang diperlukan
- Edit nota di periode DIPOSTING: tambah item (jadi nota tambahan), ubah/hapus item (ditolak).
- Nota INTERNAL (mobil/JA): tambahan membentuk hutang internal dan stok mobil yang benar.
- Laba Rugi dan Neraca 31 Okt/30 Nov sebelum vs sesudah skrip.
- Buka kembali periode: alasan wajib, tercatat.
- Konsistensi: `revenue − HPP − beban unit − beban pusat = laba operasional` tetap foot.

## 7. Keputusan terbuka
- Posting dan pembukaan bulan baru: otomatis saat bulan sebelumnya diposting (usulan) atau manual.
- Hak buka kembali: hanya admin (usulan).
- Nota tambahan ditampilkan sebagai satu nota dengan induknya di UI atau dua nota terpisah (usulan: terpisah, dengan label "Tambahan dari ...").
