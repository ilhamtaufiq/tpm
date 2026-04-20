# Analisa Laporan Service (Backend Requirement Analysis)

Analisa ini dibuat berdasarkan pembedahan file frontend (`laba-rugi.tsx`, `perubahan-modal.tsx`, `neraca.tsx`) untuk memastikan sinkronisasi data antara backend (Python/MySQL) dan frontend.

## 1. Laporan Laba Rugi (`LabaRugiService`)

Frontend mengharapkan struktur data per unit bisnis dengan detail sebagai berikut:

### Struktur Data (JSON)
```json
{
  "units": {
    "bengkel": {
      "revenue": 0,
      "hpp": 0,
      "laba_kotor": 0,
      "beban_operasional": 0,
      "beban_gaji": 0,
      "laba_bersih": 0
    },
    "jasa_angkut": {
      "revenue": 0,
      "beban_operasional": 0,
      "maintenance": 0,
      "beban_umum": 0,
      "laba_bersih": 0
    },
    "mobil": {
      "revenue": 0,
      "hpp": 0,
      "beban_operasional": 0,
      "maintenance": 0,
      "laba_bersih": 0
    }
  },
  "bengkel_details": {
    "total_parts": 0,
    "total_jasa": 0,
    "total_diskon": 0
  },
  "summary": {
    "total_beban_umum": 0,
    "prive": 0,
    "laba_operasional": 0,
    "laba_bersih": 0
  }
}
```

### Key Logic & Discrepancies
- **Jasa Angkut**: Pendapatan yang dikirim harus merupakan "Bagian TPM" (Net dari supir).
- **Mobil**: HPP harus mencakup harga beli unit + biaya restorasi yang sudah dikapitalisasi.
- **Maintenance**: Dibedakan antara pemeliharaan armada sendiri (Jasa Angkut) dan restorasi unit dagang (Mobil).

---

## 2. Laporan Perubahan Modal (`ModalService`)

Laporan ini paling kompleks karena melakukan rekonsiliasi antara modal teoritis dan saldo kas riil.

### Struktur Data (JSON)
Frontend mengharapkan 5 section utama:
- `section_a`: (Laba & Modal Awal) Mencakup setoran modal, HPP (sebagai modal tertanam), aset, dan laba kotor unit.
- `section_b`: (Piutang & Aset) Detail piutang per kategori dan nilai inventori/aset tetap.
- `section_c`: (Pengurang Modal) Arus kas keluar untuk belanja part, mobil, bagi hasil investor, operasional, gaji, dan prive.
- `section_e`: (Hutang) Kewajiban yang belum dibayar (menambah kembali modal teoritis karena kas masih ada).
- `section_d`: (Final/Kas) Saldo riil di Kas vs Transfer dan perhitungannya terhadap modal teoritis.

### Rekonsiliasi Formula
`Modal Berjalan = (A - B) - C + E`
Hasil ini harus dibandingkan dengan `D (Total Saldo Riil)`. Selisihnya dikirim sebagai `penyesuaian`.

---

## 3. Laporan Neraca (`NeracaService`)

Frontend saat ini mengharapkan data yang lebih terstruktur daripada yang diimplementasikan di backend.

### Struktur Data (JSON)
```json
{
  "aktiva_lancar": {
    "kas_tunai": 0,
    "kas_bank": 0,
    "unit_cash": 0,
    "unit_details": { "kas_unit_bengkel": 0, ... },
    "total_kas_bank": 0,
    "piutang_usaha": 0,
    "piutang_mobil": 0,
    "piutang_part_mobil": 0,
    "piutang_jasa_angkut": 0,
    "piutang_karyawan": 0,
    "piutang_lainnya": 0,
    "total_piutang": 0,
    "persediaan_sparepart": 0,
    "stok_mobil": 0,
    "total_aktiva_lancar": 0
  },
  "aktiva_tetap": {
    "detail_aset": [ { "kode": "", "nama": "", "harga_beli": 0 } ],
    "total_aktiva_tetap": 0
  },
  "modal": {
    "setoran_modal": 0,
    "modal_persediaan": 0,
    "laba_ditahan": 0,
    "detail_laba": { "bengkel": 0, "mobil": 0, "jasa_angkut": 0 },
    "total_beban": 0,
    "prive": 0,
    "total_modal": 0
  },
  "hutang": {
    "hutang_part": 0,
    "hutang_mobil": 0,
    "hutang_investor": 0,
    "hutang_lainnya": 0,
    "total_hutang": 0
  },
  "total_aktiva": 0,
  "total_pasiva": 0,
  "is_balanced": true,
  "selisih": 0
}
```

### Action Items Backend
1. **NeracaService**: Harus memecah piutang dan hutang berdasarkan kategori (sudah ada di model `PiutangUsaha` dan `HutangUsaha` melalui field `sumber` atau `tipe`).
2. **ModalService**: Tambahkan rincian `jasa_angkut_detailed_breakdown` dalam `section_c` untuk menampilkan biaya per armada.
3. **Base Service**: Pastikan `get_unit_financial_breakdown` menangkap semua tag transaksi yang dilakukan secara manual (non-otomatis) melalui filter kategori.

## Status Implementasi
- [x] Analisa Frontend
- [ ] Refactor LabaRugiService (Alignment)
- [ ] Refactor NeracaService (Detailing)
- [ ] Refactor ModalService (Reconciliation Accuracy)
