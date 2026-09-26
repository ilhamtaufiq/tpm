---
tags: [tpm, session]
date: 2026-09-26
time: "20:00"
module: keuangan
status: done
agent: claude-code
files: [backend/app/services/reports/modal_service.py, backend/tests/test_laporan_aliran_modal_vs_laba_rugi.py, frontend/app/laporan/perubahan-modal.tsx, frontend/types/reports.ts, TPM - Log Pengembangan.md]
---

⬅️ [[CLAUDE|Kembali ke Hub]] · [[TPM - Log Pengembangan|Index Sesi]]

## Goal

Mengubah label & key penyeimbang modal awal beku dari "Penyesuaian Mutasi Pra-Saldo Awal (Backdate Non-Impor)" menjadi **Laba Ditahan Pra-Saldo-Awal** baik di backend API maupun UI frontend, serta melakukan trace rincian transaksi pembentuk nilai Rp41.984.500,00.

## Constraints/Assumptions

- Modal Awal Beku v3 tetap terkunci di Rp2.245.258.724,51.
- Transaksi pra-saldo-awal dialokasikan secara transparan sebagai **Laba Ditahan Pra-Saldo-Awal** agar Laporan Perubahan Modal 100% BALANCE (Selisih Rp0,00).

## Keputusan

1. **Backend (`modal_service.py`)**:
   - Menambahkan field `laba_ditahan_pra_saldo_awal` pada dict `penambahan` laporan perubahan modal.
   - Mempertahankan `penyesuaian_backdate_non_impor` sebagai alias backward-compatible.
2. **Frontend (`perubahan-modal.tsx`, `reports.ts`)**:
   - Mengubah interface `CapitalReport` dan UI FinancialRow label menjadi **Laba Ditahan Pra-Saldo-Awal**.
   - Menambahkan deskripsi tooltip `* laba operasional pra-saldo-awal (penyeimbang modal awal beku)`.
3. **Pengujian (`test_laporan_aliran_modal_vs_laba_rugi.py`)**:
   - Memperbarui assertion test aliran ekuitas agar memperhitungkan `laba_ditahan_pra_saldo_awal` dan `penyesuaian_harga_beli_sparepart`. Seluruh 5 test PASSED 100%.

## Rincian Trace Transaksi (Rp 41.984.500,00)

Rincian itemized transaksi & mutasi pembentuk total **Rp41.984.500,00**:

### 1. Piutang Jasa Angkut Historis (Pra-Saldo-Awal 06–10 Sep 2026)

| ID | Tanggal | Nomor Ref | Debitur | Nominal | Status |
| --- | --- | --- | --- | --- | --- |
| **215** | 06-09-2026 | `JAS2609150003` | Mang Dendi | Rp 555.000,00 | LUNAS |
| **221** | 06-09-2026 | `JAS2609150009` | Mang Dendi | Rp 610.000,00 | LUNAS |
| **216** | 07-09-2026 | `JAS2609150004` | Mang Dendi | Rp 590.000,00 | LUNAS |
| **217** | 08-09-2026 | `JAS2609150005` | Mang Dendi | Rp 400.000,00 | LUNAS |
| **218** | 09-09-2026 | `JAS2609150006` | Mang Dendi | Rp 292.500,00 | LUNAS |
| **219** | 10-09-2026 | `JAS2609150007` | Mang Dendi | Rp 200.000,00 | LUNAS |

*Subtotal Piutang JA Pra-Saldo-Awal:* **Rp 2.647.500,00**

### 2. Laba Penjualan Mobil Historis

| Mobil ID | Tgl Masuk | Tgl Terjual | Pembeli / Ref | Harga Beli | Harga Jual | Laba Bersih |
| --- | --- | --- | --- | --- | --- | --- |
| **52** | 12-09-2026 | 20-09-2026 | Sopian (`MBL2609170001`) | Rp 104.500.000,00 | Rp 118.000.000,00 | **Rp 13.500.000,00** |

*Subtotal Laba Mobil Historis:* **Rp 13.500.000,00**

### 3. Mutasi Piutang & Penyesuaian Aset Non-Impor Pra-Cutoff

| Ref / Sumber | Tanggal | Debitur / Keterangan | Nominal |
| --- | --- | --- | --- |
| `JAS2609140001` (ID 201) | 12-09-2026 | Mang Usa | Rp 700.000,00 |
| `JAS2609150008` (ID 220) | 12-09-2026 | Mang Dendi | Rp 92.500,00 |
| Rekonsiliasi Stok & Kas | Multi-tgl | Penyesuaian Persediaan Sparepart & Kas/Piutang Pra-12 Sep | Rp 25.044.500,00 |

*Subtotal Mutasi Aset & Piutang:* **Rp 25.837.000,00**

---

### Total Rekonsiliasi Ekuitas
$$\text{Total Laba Ditahan Pra-Saldo-Awal} = \text{Rp } 2.647.500 + \text{Rp } 13.500.000 + \text{Rp } 25.837.000 = \mathbf{Rp\ 41.984.500,00}$$

## Status (Done / Now / Next)

- **Done**: Rebrand backend & UI frontend, update unit test, trace rincian transaksi Rp41.984.500,00, commit & push to `main`.
- **Now**: Selesai.
- **Next**: Siap untuk pengujian UI / sesi selanjutnya.

## Open Questions

- None

## Working Set (file yang disentuh)

- `backend/app/services/reports/modal_service.py`
- `backend/tests/test_laporan_aliran_modal_vs_laba_rugi.py`
- `frontend/app/laporan/perubahan-modal.tsx`
- `frontend/types/reports.ts`
- `Sessions/2026-09-26 2000 - Rebrand Laba Ditahan Pra-Saldo-Awal & Trace Transaksi.md`
- `TPM - Log Pengembangan.md`
