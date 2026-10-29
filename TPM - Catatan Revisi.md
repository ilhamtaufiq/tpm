---
tags: [tpm, revisi, catatan, roadmap]
---

# TPM — Catatan Revisi Aplikasi

Sumber: dokumen *Revisi aplikasi TPM* (22 poin). Catatan ini merangkum hasil analisis kode, status tiap poin, dan rencana pengerjaan.

⬅️ [[CLAUDE|Kembali ke Hub]]

## Status Ringkas

| Status | Jumlah | Poin |
|---|---|---|
| Selesai (Fase 1, belum di-commit) | 10 | 4, 5, 7, 10, 12, 13, 14, 16, 17, 18, 21 (sebagian) |
| Perbaikan lanjutan (di luar 22 poin) | 3 | 2 (sheet pengguna), 9 (posisi search), FAB tambah user |
| Perlu keterangan | 3 | 3, 19, 21 (transaksi hilang, perlu contoh) |
| Fase 2 (menengah) | 4 | 6, 8, 11, 20 selesai. 21 (transaksi hilang) perlu contoh |
| Fase 3 (besar) | 3 | 1, 15, 22 selesai dengan asumsi (lihat bagian Fase 3) |

Catatan: poin 7 dan 10 sama-sama soal tambah supplier saat input pembelian part, jadi dikerjakan bersama di Fase 1.

## Fase 1: Perbaikan Cepat (branch `claude/revisi-fase1`)

Branch dibuat dari `origin/main`. Perubahan belum di-commit.

- **4. Fokus pencarian part:** `SearchBox` di `frontend/app/bengkel/transaksi/index.tsx` menerima `autoFocus`. Dipasang di sheet part, servis, dan transaksi lama.
- **5. Urutan filter piutang dan hutang:** Semua, Belum Bayar, Belum Lunas, Lunas. Di hutang, BELUM_LUNAS = Belum Bayar dan SEBAGIAN = Belum Lunas. Badge detail hutang disamakan.
- **7 dan 10. Tambah supplier saat input pembelian:** tombol "Daftarkan Supplier Baru" di `components/ui/MasterDataSelector.tsx`.
- **12. Link struk langsung tampil:** `backend/app/api/v1/short_link.py` memindahkan redirect ke `<head>` dan menghapus teks "Membuka struk...". Tag OG tetap ada.
- **13. Urutan filter supir dan armada:** Semua, Aktif, Non-Aktif.
- **14. Tambah supir dan armada:** tombol berlabel di bawah filter, di `frontend/app/jasa-angkut/{supir,armada}/index.tsx`.
- **16. Aksi Cepat:** dipindah ke bawah filter periode di `frontend/app/(tabs)/finance.tsx`, judulnya dihapus.
- **17. Keyboard tertutup saat mencari antrian:** `frontend/app/bengkel/queue.tsx` memakai `keepPreviousData`. Sebelumnya skeleton menggantikan `FlatList`, sehingga input ter-unmount.
- **18. Nama grup laporan:** "Operasional & Jasa" menjadi "Bengkel & Jasa Angkut" di `frontend/app/laporan/index.tsx`.
- **21. Status transaksi bengkel di riwayat:** `backend/app/api/v1/dashboard.py` memakai `status_bayar`, bukan `status_pengerjaan`. Sebelumnya transaksi yang belum bayar tampil LUNAS.

Verifikasi: typecheck frontend bersih. Backend 174 lolos, 10 dilewati.

## Fase 2: Fitur Menengah (branch `claude/revisi-fase1`, belum di-commit)

- **6. Kirim rincian piutang dan hutang:** tombol "Kirim Rincian" di layar detail per nama (`frontend/app/finance/piutang-nama.tsx` dan `hutang-nama.tsx`). Pesan dibangun di `frontend/utils/rincianNama.ts`: per struk berisi nomor, tanggal, nominal, status, riwayat bayar, tanggal pelunasan, dan sisa. Dibagikan lewat `Share` sehingga bisa ke WhatsApp atau aplikasi lain. Belum ada link publik.
- **8. Tanggal otomatis hari ini dan ikon ubah tanggal:** `DatePicker` punya prop `autoToday` (mengisi hari ini bila kosong) dan ikon "Ubah" yang selalu terlihat di samping tanggal. `autoToday` dipasang di 11 pemakai (pembelian part, pengeluaran, kasbon, piutang, hutang, pencairan investor, muatan, mobil, dan asset).
- **11. Riwayat tampil di tanggal edit:** muatan kini memakai `updated_at` di `GET /dashboard/recent-activity`. Entri kas tidak diubah (lihat catatan teknis).
- **20. Ekspor PDF laporan:** sudah ada di semua laporan lewat `ReportExportSheet` dan `printReportHTML`. Tidak ada perubahan kode. Catatan: di laporan non-inti, Preview dan PDF memakai fungsi yang sama.
- **21 (lanjutan). Transaksi yang hilang dari riwayat:** belum bisa dipastikan. Beranda memakai `useRecentActivity(5)` sehingga hanya 5 entri, dan riwayat memakai limit 100 dengan filter sumber. Perlu contoh transaksi konkret (nomor, layar, dan filter yang dipakai).

## Catatan Teknis Fase 2

- `updated_at` berubah setiap kali baris kas diperbarui, termasuk saat saldo dihitung ulang (`rebuild_balances` dan pembatalan keuangan). Karena itu entri kas belum dipakai untuk urutan tanggal, supaya saldo ulang tidak mengangkat banyak transaksi lama ke atas riwayat.
- MariaDB lokal sering mati di sesi ini. Kalau tes gagal dengan `Can't connect ... mysqld.sock`, jalankan `service mariadb start` lalu ulang.

## Fase 3: Fitur Besar (branch `claude/revisi-fase1`, belum di-commit)

- **1. Tema ciri khas TPM (tiga warna):** `frontend/store/useUIStore.ts`. Default sekarang biru (`#023C69`), abu (`#64748B`), dan putih (permukaan `#FFFFFF`). Palet lama disimpan sebagai "TPM Klasik".
- **15. Faktur penjualan mobil:** `GET /penjualan-mobil/{id}/faktur.pdf` (A4, reportlab). Berisi nomor faktur, pembeli, data mobil, harga, DP, sisa, terbilang, tanda tangan pembeli dan penjual, serta kotak materai Rp10.000. Tombol "Faktur PDF" ada di detail unit terjual (`components/MobilDetail.tsx`). Di web dibuka di tab baru, di native dibagikan. Isi faktur, kop, dan kotak materai masih default. Belum memakai data kop dari pengaturan cetak.
- **22. Tema dan pengaturan di server:** tema tersimpan di `system_settings` (`theme_config`) lewat `PUT /settings`, dan dimuat setelah login (`app/_layout.tsx`). Admin yang mengubah tema, semua pengguna mengikuti.

Asumsi yang diambil tanpa jawaban dari Anda:
- Tema berlaku untuk seluruh perusahaan, bukan per pengguna.
- Isi faktur: data transaksi, terbilang, dan tanda tangan. Tidak ada rekening atau catatan tambahan.

## Perlu Keterangan

- **3. Fitur scan barang.** Scanner sudah dipakai di lima layar. Perlu tahu scan untuk apa, di layar mana, dan apakah ini bug atau fitur baru.
- **19. Rincian laporan tidak bisa dibuka.** Di kode, setiap baris punya handler. Perlu laporan mana, filter apa, apa yang terjadi, dan platform (app atau web).

## Piutang & Hutang Pusat (revisi lanjutan)

- **Total per struk = total per nama:** total di kedua tampilan dihitung dari grup per nama. Summary (jumlah tab) dengan `exclude_internal=true` dihitung dari jumlah `sisa_piutang` dan ikut mengecualikan internal dan BATAL. Tes: `tests/test_total_piutang_konsisten.py`.
- **Filter unit:** grup dan detail per nama ikut scope unit role, sama seperti daftar per struk.
- **Sumber menu dan keterangan saat input:** ditampilkan di detail per struk (piutang dan hutang) dan di kartu struk Per Nama. Detail per nama sekarang mengirim `sumber`, `unit`, `nomor_referensi`, `catatan`, dan riwayat bayar.
- **Filter status di Per Nama:** Semua, Belum Bayar, Belum Lunas, Lunas. Nama lolos jika punya struk dengan status itu. Total tidak ikut filter.
- **Belum dicek di web atau perangkat.** Tes backend lulus (182).

## Permintaan Lanjutan: Penamaan Piutang Per Unit dan Slip Gaji

- **Nama piutang/hutang dari transaksi unit diberi akhiran asal:** piutang bengkel jadi `Akas alam - Bengkel`, piutang internal jasa angkut jadi `Mang Usa - Jasa Angkut`, kreditur internal jadi `BENGKEL TPM - Jual Beli Mobil` / `BENGKEL TPM - Jasa Angkut`. Piutang pribadi yang diinput manual tetap memakai nama dari keterangan. Ganti nama customer ikut menjaga akhiran. Aturan: invariant 36 di `TPM - Aturan Bisnis & Invariant.md`. Tes: `tests/test_nama_piutang_transaksi.py`. Piutang/hutang lama belum diubah otomatis (perlu keputusan).
- **Slip gaji lintas minggu:** backend sudah mendukung periode Kamis s/d Rabu (preview dan bulk-range). Tes: `tests/test_slip_lintas_minggu.py`. Gejala "icon Proses tidak muncul" belum bisa direproduksi di data lokal. Perlu tanggal persis dan layar yang dilihat.
- **Tunai ke Pusat di pembayaran unit:** modal pembayaran piutang/hutang (`PaymentModal`) sudah menawarkan Tunai ke Pusat. Belum diubah: pembayaran transaksi bengkel (`BengkelPaymentModal`), form pengeluaran, muatan, dan penjualan mobil. Menunggu konfirmasi layar yang dimaksud.

## Perbaikan Lanjutan (di luar 22 poin)

- **2. Sheet edit pengguna:** `frontend/app/settings/users.tsx`. Penyebab: sheet gorhom crash saat dibuka (`_WORKLET is not defined` di animasi reanimated, di web). Diganti Modal biasa (`BottomSheetContainer`), dan tombol Simpan dipindah ke header form. Diuji di web: edit, simpan, dan sheet tertutup berhasil. Belum diuji di perangkat.
- **9. Posisi search part/supplier:** `frontend/app/bengkel/purchase/create.tsx`. Toggle "Mulai isi dari" tetap tampil dan terkunci setelah ada item atau supplier. Kolom search pindah ke bawah toggle. Belum diuji di perangkat.
- **FAB tambah user:** tombol "Tambah user" di layar Pengguna dibuat lingkaran (FAB), posisi sama dengan FAB di layar lain. Diuji di web: tampil dan membuka form.

## Pembatalan Keuangan (fitur tambahan)

- Biaya operasional, kasbon/piutang, kasbon karyawan, dan transfer kas bisa dibatalkan dengan alasan wajib. Tidak ada hapus fisik. Jurnal dibalik dan tercatat di Riwayat Pembatalan.
- Ada di branch `claude/pembatalan-keuangan`, PR #135. Migrasi `d4e6f8a0b2c3`.
- Cara pakai dan aturannya: invariant 35 di `TPM - Aturan Bisnis & Invariant.md`.

## Catatan Teknis

- Beberapa file sumber memakai CRLF. Saat mengedit dengan skrip, pastikan line ending tidak berubah, karena diff bisa membengkak.
- Migrasi `d4e6f8a0b2c3` (pembatalan keuangan) harus dijalankan di server sebelum deploy.
- Uji web lokal: setelah mengedit, jalankan Metro dengan `--clear` dan pastikan bundle memuat perubahan. Beberapa perubahan tidak terdeteksi tanpa restart.
- Dependensi (`nativewind`, `react-native-css-interop`, `react-native-worklets`) tidak diubah. Sempat dicoba, tapi tidak perlu.

⬅️ [[CLAUDE|Kembali ke Hub]]
