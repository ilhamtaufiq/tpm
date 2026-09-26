---
tags: [tpm, session, mobil, bengkel, void, edit-item]
date: 2026-09-26
time: "18:30"
module: mobil
status: done
agent: claude
files: [frontend/components/RelatedBengkelTransactions.tsx, frontend/components/MobilDetail.tsx]
---

⬅️ [[CLAUDE|Kembali ke Hub]] · [[TPM - Log Pengembangan|Index Sesi]]

## Goal

Menambahkan tombol dan aksi pembatalan transaksi bengkel (`useVoidTransaksiBengkel`) serta edit per-item (`/bengkel/order?id={id}`) pada komponen `RelatedBengkelTransactions` di detail mobil, dan memastikan modal detail mobil tertutup otomatis (`onClose?.()`) sebelum navigasi ke halaman edit item.

## Constraints/Assumptions

- `useVoidTransaksiBengkel` membatalkan seluruh transaksi bengkel via REST API `DELETE /transaksi-bengkel/{id}`.
- `AlertDialog` digunakan untuk konfirmasi pembatalan.
- Apabila transaksi dibatalkan (`BATAL`), badge merah ditampilkan dan tombol `Batalkan` serta `Edit Item` disembunyikan.
- Edit per-item mengarahkan pengguna ke screen `/bengkel/order?id={id}` (`BengkelForm`) untuk memodifikasi, menambah, atau menghapus item sparepart/servis secara individu.

## Keputusan

- Mengubah `frontend/components/RelatedBengkelTransactions.tsx`:
  - Menambahkan `useVoidTransaksiBengkel` + state `voidDialog` + `AlertDialog`.
  - Menambahkan tombol `Edit Item` (menggunakan `useRouter` dari `expo-router`) yang memanggil `onClose?.()` agar modal detail mobil tertutup otomatis sebelum berpindah halaman.
  - Memperbarui `MobilDetail.tsx` untuk meneruskan prop `onClose` ke `RelatedBengkelTransactions`.

## Status (Done / Now / Next)

- **Done**:
  - `frontend/components/RelatedBengkelTransactions.tsx`: Aksi void transaksi + konfirmasi modal + edit item dengan penutupan modal otomatis.
  - `frontend/components/MobilDetail.tsx`: Meneruskan `onClose` prop ke `RelatedBengkelTransactions`.
  - Typecheck `npx tsc --noEmit` sukses (0 error).
- **Now**: Selesai.
- **Next**: Await feedback dari user.

## Open Questions

- None.
