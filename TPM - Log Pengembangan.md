---
tags: [tpm, log, jurnal, moc]
---

# TPM — Log Pengembangan (Index Sesi)

⬅️ [[CLAUDE|Kembali ke Hub]] · Format sesi: [[TPM - Konvensi Sesi & Pencarian]] · Template: [[Templates/TPM Session Template]]

> File ini adalah **index**, bukan tempat menulis isi sesi. Isi sesi ditulis satu-file-satu-sesi di folder `Sessions/`. Lihat [[TPM - Konvensi Sesi & Pencarian]] untuk cara bikin sesi baru dan cara pencarian.

## Kalau Pakai Plugin Dataview

Tempel query ini (hapus fence terluar) supaya daftar di bawah otomatis ter-update setiap ada file sesi baru — tidak perlu edit manual:

````
```dataview
TABLE date, module, status, agent
FROM "Sessions"
SORT date DESC, time DESC
```
````

Bisa juga difilter, misal khusus modul keuangan yang masih `blocked`:

````
```dataview
TABLE date, status
FROM "Sessions"
WHERE module = "keuangan" AND status = "blocked"
SORT date DESC
```
````

## Kalau Tidak Pakai Dataview (daftar manual)

Tambahkan baris baru di atas (terbaru dulu) setiap bikin sesi baru:

| Tanggal | Modul | Status | Sesi |
|---|---|---|---|
| 2026-09-26 | keuangan | done | [[Sessions/2026-09-26 2100 - Sinkronisasi Laporan Keuangan Dashboard Web dengan Invarian Ekuitas]] |
| 2026-09-26 | keuangan | done | [[Sessions/2026-09-26 2000 - Rebrand Laba Ditahan Pra-Saldo-Awal & Trace Transaksi]] |
| 2026-09-26 | testing | done | [[Sessions/2026-09-26 1900 - Pengujian Regresi Keseimbangan Neraca dan Ekuitas serta Pemulihan Stok Sparepart]] |
| 2026-09-26 | jasa-angkut | done | [[Sessions/2026-09-26 1845 - Fitur Pembatalan dan Edit Item Perbaikan Bengkel Armada Jasa Angkut]] |
| 2026-09-26 | mobil | done | [[Sessions/2026-09-26 1830 - Fitur Pembatalan dan Edit Item Transaksi Bengkel pada Mobil Detail]] |
| 2026-09-26 | ui | done | [[Sessions/2026-09-26 1800 - Penanganan Intersepsi Back Button Bottom Sheet Mobile Web]] |
| 2026-09-26 | bengkel | done | [[Sessions/2026-09-26 1730 - Refactor Kartu Antrian Bengkel Urutan Customer Plat Kategori]] |
| 2026-09-26 | keuangan | done | [[Sessions/2026-09-26 1700 - Baris Penyesuaian Backdate Non-Impor & Invarian Balance Ekuitas]] |
| 2026-09-26 | keuangan | done | [[Sessions/2026-09-26 1630 - Analisis Void Bengkel Kas Transfer & Invarian Modal Awal]] |
| 2026-09-26 | keuangan | done | [[Sessions/2026-09-26 1545 - Analisis Void Transaksi Bengkel JB Mobil & Penyeimbangan Kas]] |
| 2026-09-26 | bengkel | done | [[Sessions/2026-09-26 1515 - Analisis Race Condition Stok Lem Threebond Part 469]] |
| 2026-09-26 | arsitektur | done | [[Sessions/2026-09-26 1500 - Init CLAUDE.md & Sinkronisasi Obsidian]] |
| 2026-09-26 | bengkel | done | [[Sessions/2026-09-26 0000 - Refactor Header Master Data & Standalone Bengkel Pages]] |

⬅️ [[CLAUDE|Kembali ke Hub]]
