---
tags: [tpm, session]
date: 2026-09-30
time: "13:15"
module: keuangan
status: done
agent: claude-code
files: [backend/app/services/kas_bank_service.py]
---

⬅️ [[CLAUDE|Kembali ke Hub]] · [[TPM - Log Pengembangan|Index Sesi]]

## Goal

Perbaiki error 409 conflict "Duplikat transaksi" yang salah saat melakukan pembayaran cicilan/pelunasan hutang kedua ke atas.

## Temuan

Guard anti-duplikat di `kas_bank_service.py:144-149` memfilter `KasBank` berdasarkan `(jenis, tipe, nomor_referensi)`. 

Untuk transaksi pembayaran hutang, `nomor_referensi` diisi dengan `hutang.nomor_hutang` (mis. `HTG2509300001`) yang **sama untuk semua cicilan** pembayaran pada hutang tersebut. 

Akibatnya, saat pengguna melakukan pembayaran ke-2 pada hutang yang sama, `KasBankService.create` menolak dengan error 409 Conflict ("Duplikat transaksi sudah ada"), sehingga transaksi gagal / user terdorong mencoba ulang.

## Fix

Sempurnakan pencocokan duplikat saat `nomor_referensi` tersedia dengan menambahkan `referensi_id` (`pembayaran.id`) dan `tanggal`:

```python
dup = self.db.query(KasBank).filter(
    KasBank.jenis == data.jenis,
    KasBank.tipe == data.tipe,
    KasBank.nomor_referensi == data.nomor_referensi,
    KasBank.referensi_id == data.referensi_id,
    KasBank.tanggal == data.tanggal,
).first()
```

Setiap pembayaran hutang menghasilkan record `PembayaranHutang` baru dengan `id` unik (`referensi_id`), sehingga pembayaran cicilan berikutnya untuk `nomor_hutang` yang sama tidak lagi dianggap duplikat.

## Status

✅ Fix diterapkan, pytest pass, ter-commit dan push ke main.
