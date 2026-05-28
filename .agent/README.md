# TPM Agent Documentation Index

Dokumen ini adalah pintu masuk utama untuk memahami folder `.agent`.

Gunakan file ini untuk:
- mengetahui dokumen mana yang perlu dibaca lebih dulu,
- memilih referensi yang tepat saat debugging,
- memahami hubungan antara bisnis, kode, serta laporan keuangan TPM.

## 1. Urutan Baca yang Disarankan

### Jika baru pertama kali masuk proyek
1. `CONTEXT.md`
2. `TECH_STACK.md`
3. `DATABASE_SCHEMA.md`
4. `FINANCIAL_FLOW.md`
5. `ACCOUNTING_RULES.md`
6. `SYNC_LOGIC.md`

### Jika akan mengerjakan modul finance/reporting
1. `ACCOUNTING_RULES.md`
2. `FINANCIAL_FLOW.md`
3. `SYNC_LOGIC.md`
4. `FILE_MAP_FINANCE.md`
5. `INTERNAL_TRANSACTIONS.md`

### Jika akan mengerjakan frontend
1. `CONTEXT.md`
2. `FRONTEND_GUIDE.md`
3. `TECH_STACK.md`
4. `GUIDELINES.md`

## 2. Ringkasan Tiap Dokumen

| Dokumen | Fungsi utama |
|---|---|
| `CONTEXT.md` | Gambaran bisnis, unit utama, dan cara membaca sistem. |
| `TECH_STACK.md` | Arsitektur backend/frontend dan struktur teknis proyek. |
| `DATABASE_SCHEMA.md` | Nama tabel aktual dan relasi penting database. |
| `FINANCIAL_FLOW.md` | Alur uang, stok, piutang/hutang, kasbon, dan dampaknya ke laporan. |
| `ACCOUNTING_RULES.md` | Aturan akuntansi khusus TPM yang tidak boleh dilanggar. |
| `SYNC_LOGIC.md` | Hubungan Laba Rugi, Perubahan Modal, dan Neraca. |
| `FILE_MAP_FINANCE.md` | Peta file finance/reporting dan urutan debugging berbasis kode. |
| `INTERNAL_TRANSACTIONS.md` | Detail transaksi antar-unit, khususnya repair internal mobil. |
| `FRONTEND_GUIDE.md` | Struktur route, state, security, data fetching, dan praktik frontend. |
| `GUIDELINES.md` | Aturan kerja lintas backend/frontend/reporting saat membuat perubahan. |

## 3. Jika Masalahnya X, Buka Dokumen Y

| Masalah / kebutuhan | Mulai dari |
|---|---|
| Belum paham bisnis TPM | `CONTEXT.md` |
| Bingung struktur kode | `TECH_STACK.md` |
| Ingin tahu nama tabel yang benar | `DATABASE_SCHEMA.md` |
| Saldo kas atau routing wallet membingungkan | `ACCOUNTING_RULES.md` + `FINANCIAL_FLOW.md` |
| Neraca tidak seimbang | `SYNC_LOGIC.md` + `FILE_MAP_FINANCE.md` |
| Laba Rugi, Modal, Neraca tidak sinkron | `SYNC_LOGIC.md` |
| Repair bengkel ke mobil stok bikin laporan aneh | `INTERNAL_TRANSACTIONS.md` |
| Mau tahu file backend mana yang harus diedit | `FILE_MAP_FINANCE.md` |
| Perubahan UI/front-end | `FRONTEND_GUIDE.md` |
| Takut patch melanggar aturan sistem | `GUIDELINES.md` |

## 4. Peta Hubungan Dokumen

```text
CONTEXT
  -> menjelaskan bisnis dan unit
  -> didukung oleh TECH_STACK dan DATABASE_SCHEMA

FINANCIAL_FLOW
  -> menjelaskan pergerakan nilai
  -> dibatasi oleh ACCOUNTING_RULES
  -> harus tetap sinkron menurut SYNC_LOGIC

FILE_MAP_FINANCE
  -> menghubungkan konsep finance ke file kode nyata
  -> sangat penting saat debugging INTERNAL_TRANSACTIONS

FRONTEND_GUIDE
  -> menjelaskan bagaimana konsep-konsep di atas muncul di aplikasi pengguna

GUIDELINES
  -> aturan kerja agar perubahan baru tetap konsisten dengan semua dokumen lain
```

## 5. Prinsip Pemakaian
- Jangan membaca dokumen ini sebagai spesifikasi abstrak yang terpisah dari kode.
- Jika ada konflik antara dokumentasi dan implementasi aktual, verifikasi kode lalu perbarui dokumentasi.
- Untuk perubahan finance, anggap perubahan belum selesai sampai dampaknya ke laporan dan dokumen terkait sudah dipikirkan.

## 6. Checklist Cepat Sebelum Mengubah Sistem
- Apakah saya paham unit bisnis yang terdampak?
- Apakah transaksi ini mengubah kas, piutang/hutang, stok, atau hanya klasifikasi?
- Apakah ada dampak ke tiga laporan utama?
- Apakah ini menyentuh transaksi internal?
- Dokumen `.agent` mana yang perlu ikut diperbarui?
