# RTK - Rust Token Killer (Codex CLI)

Always prefix shell commands with `rtk`.

Prefer RTK-native commands so output can be filtered and counted by `rtk gain`.
Avoid `rtk powershell -Command ...` unless a task truly needs PowerShell-specific syntax.

## Communication Mode

Use Caveman mode by default for this project:
- answer terse, direct, and token-efficient;
- keep technical terms exact;
- combine with RTK by using `rtk` for shell commands whenever possible;
- leave Caveman mode only when clarity, safety warnings, or explicit user request require normal prose.

## Common Commands

```bash
rtk git status --short --branch
rtk git diff --stat
rtk git log --oneline -5
rtk read frontend/app/laporan/neraca.tsx
rtk grep "total_hutang" backend/app/services/reports/neraca_service.py
rtk ls frontend/app/laporan
rtk find frontend -name "*.tsx"
rtk tsc --noEmit
rtk npm run build
rtk gain
```

## Finance / Laporan Guardrail

- Flow keuangan dan laporan keuangan dianggap sudah stabil sebagai baseline operasional.
- Setiap perubahan yang menyentuh `finance`, `laporan`, `kas_bank`, `piutang`, `hutang`, `neraca`, `laba_rugi`, atau `perubahan_modal` harus diverifikasi end-to-end.
- Verifikasi minimum:
  - cek dampak UI;
  - cek source data / service;
  - cek konsistensi laporan;
  - jalankan typecheck atau test yang relevan.
- Setiap perubahan finance/laporan wajib dicatat di dokumentasi alur keuangan/laporan keuangan sebelum dianggap selesai.
- Jika ada perubahan perilaku, update dokumen alur keuangan/laporan agar tetap jadi single source of truth.
- Dokumen acuan ada di `.agent/FINANCE_REPORTING_GUARDRAIL.md`.

## Windows Notes

Use forward slashes in paths when possible:

```bash
rtk read frontend/app/laporan/perubahan-modal.tsx
```

Use `rtk proxy` only when the raw command output is needed:

```bash
rtk proxy powershell -Command "Get-Process"
```
