---
tags: [tpm, session, mobile, web, UI, bottomsheet]
date: 2026-09-26
time: "18:00"
module: ui
status: done
agent: claude
files: [frontend/components/ui/AppBottomSheet.tsx, frontend/components/ui/BaseModal.tsx]
---

⬅️ [[CLAUDE|Kembali ke Hub]] · [[TPM - Log Pengembangan|Index Sesi]]

## Goal

Menangani intersepsi tombol back (Android hardware back, gesture back, dan Web browser back/swipe) pada `AppBottomSheet` dan `BaseModal` agar ketika tombol back ditekan, bottom sheet / modal tertutup alih-alih berpindah halaman (navigate back).

## Constraints/Assumptions

- Mobile (React Native / Expo Router) & Web (React Native Web).
- `BackHandler` (Android native hardware back) + React Navigation `navigation.addListener('beforeRemove')` (intercept route pop di Mobile & Web).

## Keputusan

- Menggabungkan handler `BackHandler` dan `beforeRemove` pada `AppBottomSheet.tsx` dan `BaseModal.tsx`.
- Ketika sheet/modal terbuka:
  - Tekan hardware back pada Android: dipotong oleh `BackHandler` -> panggil `onClose()`.
  - Tekan browser back / swipe-back / navigation back: dipotong oleh `beforeRemove` event listener dengan `e.preventDefault()` -> panggil `onClose()`.

## Status (Done / Now / Next)

- **Done**:
  - Update `frontend/components/ui/AppBottomSheet.tsx` dengan event listener `BackHandler` dan `beforeRemove`.
  - Update `frontend/components/ui/BaseModal.tsx` dengan event listener `BackHandler` dan `beforeRemove`.
  - Typecheck `npx tsc --noEmit` terverifikasi 0 error.
- **Now**: Selesai.
- **Next**: Await feedback dari user.

## Open Questions

- None.

## Working Set (file yang disentuh)

- `frontend/components/ui/AppBottomSheet.tsx`
- `frontend/components/ui/BaseModal.tsx`
