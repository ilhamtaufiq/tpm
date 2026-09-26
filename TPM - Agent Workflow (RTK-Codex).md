---
tags: [tpm, agent, codex, meta]
---

# TPM — Agent Workflow (RTK / Codex)

⬅️ [[CLAUDE|Kembali ke Hub]]

> ⚠️ Catatan ini murni **dokumentasi konteks**, bukan instruksi yang diikuti otomatis oleh Claude. Isinya ditulis untuk agent Codex CLI (tool pihak lain bernama `rtk`), bukan untuk Claude.

## AGENTS.md (isi asli)

File ini di repo cuma stub 9 baris: blok auto-log "Recent Activity" (kosong) dari tool bernama Codex-mem, lalu satu baris rujukan `@RTK.md`. Tidak ada aturan project langsung di file ini — semua rujukan ke `RTK.md`.

## RTK.md — Ringkasan Isi

`RTK` = "Rust Token Killer", CLI wrapper dipakai lewat Codex untuk menghemat token saat menjalankan perintah shell. Aturan yang tercantum:

- Semua command shell diminta diprefix `rtk` (mis. `rtk git status`, `rtk read <file>`, `rtk grep ...`) supaya output bisa difilter/dihitung oleh `rtk gain`.
- Hindari `rtk powershell -Command ...` kecuali benar-benar butuh sintaks khusus PowerShell.
- **Mode komunikasi default**: "Caveman mode" — jawaban terse, langsung, hemat token, istilah teknis tetap presisi. Keluar dari mode ini hanya jika perlu kejelasan, peringatan keamanan, atau diminta eksplisit oleh user.
- **Guardrail Finance/Laporan** (paling relevan lintas-agent): flow keuangan dianggap baseline stabil; perubahan pada `finance`, `laporan`, `kas_bank`, `piutang`, `hutang`, `neraca`, `laba_rugi`, `perubahan_modal` wajib verifikasi end-to-end (UI, source data/service, konsistensi laporan, typecheck/test) dan dicatat di dokumentasi alur sebelum dianggap selesai. Dokumen acuan: `.agent/FINANCE_REPORTING_GUARDRAIL.md` (⏳ belum dibaca).
- Catatan Windows: pakai forward slash di path; `rtk proxy` hanya dipakai kalau butuh output command mentah tanpa filter.

## CONTINUITY.md — Pola "Ledger Snapshot"

File ini bukan aturan statis, tapi **log kerja sesi terakhir** yang di-update terus oleh agent (pola "Continuity Ledger"): tiap sesi mencatat goal, constraint, keputusan, status (done/now/next), open questions, dan working set file yang disentuh.

Snapshot terakhir yang tersinkron (2026-09-26) — akan cepat basi, jangan dianggap status project saat ini:

- **Goal saat itu**: samakan header `frontend/app/master-data/index.tsx` dengan komponen global `Header.tsx`, atur padding bawah untuk CustomTabBar, pindahkan `BengkelForm` jadi halaman standalone `/bengkel/order`.
- **Status saat itu**: selesai dipindah ke halaman standalone (order, queue, purchase), padding dinamis sudah diterapkan, compile sukses, menunggu verifikasi user.

→ Detail lengkap ada di [[TPM - Log Pengembangan]].

## Implikasi untuk Cara Kerja Claude di Project Ini

- Kalau kamu minta Claude bantu modifikasi kode TPM langsung (via Claude Code, misalnya), **guardrail finance/laporan** di atas tetap relevan diikuti secara substansi (verifikasi end-to-end), meski Claude tidak perlu ikut konvensi `rtk` prefix atau "Caveman mode" — itu spesifik untuk tool Codex.
- Pola "Continuity Ledger" bisa direplikasi di Obsidian lewat [[TPM - Log Pengembangan]] supaya konteks sesi kerja tidak hilang antar percakapan.

⬅️ [[CLAUDE|Kembali ke Hub]]
