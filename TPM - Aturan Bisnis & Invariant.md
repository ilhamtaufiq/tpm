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
