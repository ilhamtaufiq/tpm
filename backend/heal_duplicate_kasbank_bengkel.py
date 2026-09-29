"""Reversal 37 baris duplikat KasBank hasil sync BENGKEL 2026-09-26 19:46:48.

Konteks bug:
  Operasi sync pembayaran piutang bengkel pada 2026-09-26 19:46:48 meng-insert
  ULANG seluruh riwayat pembayaran yang sudah tercatat (id 426-463), di kedua
  jenis kas (KAS_UTAMA & BANK_UTAMA), sekaligus mem-backdate tanggalnya
  (created_at - tanggal = 2..11 hari).

  Setiap baris di blok itu punya pasangan persis (sumber+tipe+nominal+tanggal)
  di blok lama -- KECUALI id 449 (PTG2609220002, 1.625.000) yang sah.

  Terverifikasi: membuang 426-463 (kecuali 449) mendaratkan saldo TEPAT di
  target yang disepakati:
      KAS_UTAMA  11.647.500 -> 6.011.500
      BANK_UTAMA 844.059.876 -> 811.321.376

Metode: REVERSAL (jurnal balik), BUKAN delete fisik -- sesuai invarian #3
CLAUDE.md ("Transaksi berjurnal tidak boleh di-DELETE; wajib Reversal Transaction").

Idempotent: reversal diberi marker unik & dicek dulu, jadi aman dijalankan berulang.

Jalankan:
  cd backend && python heal_duplicate_kasbank_bengkel.py          # dry-run
  cd backend && python heal_duplicate_kasbank_bengkel.py --apply  # eksekusi
"""
import os
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models.keuangan import KasBank
from app.schemas.keuangan import KasBankCreate
from app.services.kas_bank_service import KasBankService
from app.utils.constants import KasBankType, KasBankJenis

BULK_IDS = list(range(426, 464))   # 426..463
KEEP_ID = 449                       # satu-satunya anggota blok yang SAH
MARKER = "HEAL-DUP-BGL260926"
VOID_DATE = date(2026, 9, 28)       # tanggal reversal; TIDAK menyentuh tanggal asli

TARGET = {
    KasBankJenis.KAS_UTAMA: 6011500.0,
    KasBankJenis.BANK_UTAMA: 811321376.01,
}


def _net(db, jenis):
    rows = db.query(KasBank).filter(KasBank.jenis == jenis).all()
    return sum(
        float(k.nominal or 0) * (-1 if k.tipe == KasBankType.KELUAR else 1)
        for k in rows
    )


def main(apply: bool):
    db = SessionLocal()
    try:
        dupes = [
            k for k in db.query(KasBank).filter(KasBank.id.in_(BULK_IDS)).all()
            if k.id != KEEP_ID
        ]
        print("=== APPLY ===" if apply else "=== DRY-RUN ===")
        print(f"Baris duplikat terdeteksi : {len(dupes)} (dari {len(BULK_IDS)} di blok)")
        print(f"Baris SAH dikecualikan    : id={KEEP_ID}\n")

        if not dupes:
            print("Tidak ada yang perlu di-reversal. Selesai.")
            return

        total = sum(float(k.nominal or 0) for k in dupes)
        print(f"Total nominal di-reversal : Rp{total:,.0f}\n")

        already = db.query(KasBank).filter(
            KasBank.keterangan.like(f"%{MARKER}%")
        ).count()
        if already:
            print(f"PERINGATAN: sudah ada {already} baris reversal bermarker "
                  f"{MARKER} -> idempotent, TIDAK dibuat ulang.")

        svc = KasBankService(db)
        for k in dupes:
            rev_type = KasBankType.KELUAR if k.tipe == KasBankType.MASUK else KasBankType.MASUK
            print(f"  id={k.id:4} {k.tanggal} {k.jenis.name:12} "
                  f"{k.tipe.name:7} -> {rev_type.name:7} Rp{float(k.nominal or 0):>14,.0f} "
                  f"ref={k.nomor_referensi}")
            if apply:
                svc.create(
                    KasBankCreate(
                        tanggal=VOID_DATE,
                        jenis=k.jenis,
                        tipe=rev_type,
                        nominal=k.nominal,
                        sumber=k.sumber,
                        metode_bayar=k.metode_bayar,
                        referensi_id=k.referensi_id,
                        nomor_referensi=k.nomor_referensi,
                        keterangan=f"[VOID] {MARKER}: reversal duplikat sync 2026-09-26 19:46 (asli id={k.id})",
                        allow_negative=True,
                    ),
                    commit=False,
                )

        if apply:
            db.commit()
            print(f"\n{len(dupes)} reversal ditulis + commit.")
        else:
            db.rollback()
            print("\nDRY-RUN: tidak ada perubahan. Jalankan dengan --apply untuk eksekusi.")

        print("\n=== SALDO ===")
        for jenis, tgt in TARGET.items():
            now = _net(db, jenis)
            print(f"  {jenis.name:12} {now:>16,.2f}  target {tgt:>16,.2f}  "
                  f"delta {now - tgt:>+12,.2f}")
    finally:
        db.close()


if __name__ == "__main__":
    main("--apply" in sys.argv)
