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
FROM "Projects/TPM/Sessions"
SORT date DESC, time DESC
```
````

Bisa juga difilter, misal khusus modul keuangan yang masih `blocked`:

````
```dataview
TABLE date, status
FROM "Projects/TPM/Sessions"
WHERE module = "keuangan" AND status = "blocked"
SORT date DESC
```
````

## Kalau Tidak Pakai Dataview (daftar manual)

Tambahkan baris baru di atas (terbaru dulu) setiap bikin sesi baru:

| Tanggal | Modul | Status | Sesi |
|---|---|---|---|
| 2026-09-26 | keuangan | done | [[Sessions/2026-09-26 1630 - Analisis Void Bengkel Kas Transfer & Invarian Modal Awal]] |
| 2026-09-26 | keuangan | done | [[Sessions/2026-09-26 1545 - Analisis Void Transaksi Bengkel JB Mobil & Penyeimbangan Kas]] |
| 2026-09-26 | bengkel | done | [[Sessions/2026-09-26 1515 - Analisis Race Condition Stok Lem Threebond Part 469]] |
| 2026-09-26 | arsitektur | done | [[Sessions/2026-09-26 1500 - Init CLAUDE.md & Sinkronisasi Obsidian]] |
| 2026-09-26 | bengkel | done | [[Sessions/2026-09-26 0000 - Refactor Header Master Data & Standalone Bengkel Pages]] |

⬅️ [[CLAUDE|Kembali ke Hub]]
