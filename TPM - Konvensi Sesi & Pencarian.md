---
tags: [tpm, meta, konvensi]
---

# TPM — Konvensi Sesi & Pencarian

⬅️ [[CLAUDE|Kembali ke Hub]]

Tujuan: setiap sesi kerja (chat dengan Claude/Codex/agent lain, atau kerja manual) dicatat sebagai **satu file terpisah** di folder `Sessions/`, bukan ditumpuk di satu file panjang. Ini bikin pencarian — baik manual (Ctrl/Cmd+Shift+F) maupun oleh AI agent (grep/ripgrep) — jauh lebih cepat karena tiap file kecil, judul jelas, dan metadata konsisten.

## Struktur Folder

```
tpm/ (Vault Root)
├── CLAUDE.md
├── TPM - Konvensi Sesi & Pencarian.md   ← file ini
├── TPM - Log Pengembangan.md            ← index/MOC, bukan isi sesi
├── Sessions/
│   ├── 2026-09-26 1430 - Refactor Header Master Data.md
│   ├── 2026-09-27 0900 - Fix Bug Neraca.md
│   └── ...
└── Templates/
    └── TPM Session Template.md
```

## Penamaan File Sesi

```
YYYY-MM-DD HHmm - Ringkasan singkat topik.md
```

- Tanggal + jam di depan → otomatis urut kronologis di file explorer.
- Ringkasan topik singkat (3-6 kata) → langsung kelihatan isinya tanpa buka file.
- Hindari `:` di nama file (tidak valid di Windows) — pakai `HHmm` tanpa titik dua.

## Frontmatter Wajib (kunci pencarian utama)

Setiap file sesi **wajib** punya frontmatter ini di baris paling atas:

```yaml
---
tags: [tpm, session]
date: 2026-09-26
time: "14:30"
module: bengkel        # bengkel | mobil | angkut | sdm | keuangan | arsitektur | lainnya
status: done            # done | in-progress | blocked
agent: claude-code      # claude-code | codex | manual | claude-chat
files: [frontend/app/master-data/index.tsx, frontend/components/BengkelForm.tsx]
---
```

Kenapa field ini penting untuk pencarian:
- `tags: [tpm, session]` → semua sesi kena filter lewat pencarian tag `#tpm/session` atau search `tag:session`.
- `module` → agent/kamu bisa filter "semua sesi yang menyentuh modul keuangan" dengan search `module: keuangan`.
- `status: blocked` → gampang nemuin sesi yang masih nyangkut, tinggal search `status: blocked`.
- `files: [...]` → kalau agent mau tahu "riwayat perubahan di file X", tinggal grep nama file itu di semua frontmatter sesi.

## Heading Wajib di Isi (biar konsisten & mudah di-grep)

```markdown
## Goal
## Constraints/Assumptions
## Keputusan
## Status (Done / Now / Next)
## Open Questions
## Working Set (file yang disentuh)
```

Heading yang selalu sama artinya agent bisa langsung cari section tertentu lintas semua file sesi (misal: cari semua `## Open Questions` yang belum kosong untuk tahu apa saja yang masih menggantung).

## Cara Agent (atau kamu) Mencari

Tanpa plugin apapun, di dalam Obsidian:
- `Ctrl/Cmd+Shift+F` → search `module: keuangan` → semua sesi terkait modul keuangan muncul.
- Search `status: blocked` → semua sesi yang masih nyangkut.
- Search nama file kode (misal `neraca_service.py`) → semua sesi yang pernah menyentuh file itu (karena field `files:`).

Kalau pakai **Claude Code / agent berbasis file system** (bukan lewat search bar Obsidian), agent bisa `grep -rl "module: keuangan" Sessions/` atau `grep -rl "neraca_service.py" Sessions/` langsung dari terminal — makanya format frontmatter YAML polos (bukan dataview inline `::`) dipilih, supaya `grep` biasa pun kebaca tanpa parser khusus.

## (Opsional) Kalau Pakai Plugin Dataview

Kalau plugin **Dataview** aktif, `TPM - Log Pengembangan.md` bisa otomatis me-list semua sesi tanpa update manual — lihat isi file itu untuk query siap pakai. Tanpa Dataview, kamu update daftar link manual di file yang sama tiap bikin sesi baru (satu baris, tidak berat).

⬅️ [[CLAUDE|Kembali ke Hub]]
