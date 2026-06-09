# Finance Reporting Guardrail

Status: stable, verified, single source of truth for finance/reporting changes.

## Scope

Dokumen ini mencakup alur yang menyentuh:
- `finance`
- `laporan`
- `kas_bank`
- `piutang`
- `hutang`
- `neraca`
- `laba_rugi`
- `perubahan_modal`

## Aturan Perubahan

Setiap perubahan yang menyentuh area di atas wajib:
1. diverifikasi end-to-end;
2. dicek dampaknya ke UI, service, dan data sumber;
3. dipastikan tidak merusak konsistensi laporan;
4. dicatat di dokumen ini jika ada perubahan flow, label, atau aturan hitung.

## Investor Reversal Requirement

Untuk mobil milik investor:
- `cancel-sale` tidak boleh dijalankan sebelum pencairan investor direversal secara eksplisit.
- Reversal wajib memakai endpoint `/penjualan-mobil/{id}/investor/reversal`.
- Setelah reversal, validasi ulang saldo kas, status pencairan, dan histori laporan yang terdampak.
- Riwayat pencairan yang direversal harus tetap terlihat dan diberi penanda `REVERSED`, bukan dihapus dari histori.
- Jika ada perubahan pada flow ini, pastikan notifikasi / realtime coverage ikut dicek ulang.

## Bengkel Work Order Finance Gate

Untuk transaksi bengkel:
- `ANTRE` dan `PROSES` adalah work order / open bill operasional, bukan transaksi finansial final.
- **Pendapatan, laba rugi, neraca, perubahan modal, HPP, dan nilai persediaan** hanya boleh mengakui transaksi bengkel dengan `status_pengerjaan = SELESAI`.
- Order slip dan bill order boleh berisi sparepart/servis, tetapi belum boleh menaikkan pendapatan, internal repair, atau HPP laporan.
- Dashboard operasional boleh menampilkan `ANTRE/PROSES`; dashboard atau laporan finansial wajib memakai filter final finance.

### Pengecualian: DP / Pembayaran Awal (Uang Muka)

DP yang diterima saat status `ANTRE` atau `PROSES` **boleh** langsung dicatat ke `kas_bank` dan `piutang` karena:
- DP adalah arus kas nyata (uang sudah diterima), bukan pengakuan pendapatan.
- `piutang` dicreate dengan nominal = `grand_total`, lalu dikurangi sebesar DP. Sisa piutang mencerminkan tagihan yang belum dibayar.
- `kas_bank` mendebit sejumlah DP yang masuk — ini fakta kas, bukan revenue recognition.
- **Pendapatan / Laba / HPP tetap tidak diakui** sampai `status_pengerjaan = SELESAI`.

Alur balance:
1. **Saat DP masuk** (ANTRE/PROSES): Kas +DP, Piutang nominal=total, dibayar=DP, sisa=total-DP.
2. **Saat SELESAI & pelunasan**: Kas +sisa, Piutang lunas, Pendapatan diakui penuh.

Implementasi: `transaksi_bengkel_service.py` → `should_finalize_finance = SELESAI or has_upfront_payment`. DP diproses via `piutang_service.process_payment_split()`.

## Checklist Verifikasi Minimum

- UI sesuai flow terbaru.
- Data yang dipakai screen sesuai service/backend.
- Nominal, status, dan filter laporan tetap konsisten.
- Hasil laporan tidak berubah tanpa alasan bisnis yang jelas.
- `tsc` atau test relevan lolos.
- Kalau perubahan menyentuh data live, cek juga `REALTIME_COVERAGE.md` untuk emitter dan scope yang terdampak.

## Prinsip

- Jangan ubah logika laporan hanya untuk menutupi selisih.
- Jika flow keuangan berubah, update dokumentasi ini dulu atau bersamaan dengan implementasi.
- Untuk perubahan yang berdampak ke laporan, dokumentasi ini adalah referensi utama sebelum review lanjutan.
- Untuk perubahan yang butuh live refresh, update juga `.agent/REALTIME_COVERAGE.md`.
