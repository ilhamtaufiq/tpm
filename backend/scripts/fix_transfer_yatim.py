"""
Script: koreksi transfer yatim (kaki keluar tersimpan, kaki masuk tidak).

Bug: transfer antar akun membuat kaki keluar dan kaki masuk dengan commit terpisah.
Jika kaki masuk gagal, kaki keluar tetap tersimpan: kas berkurang, bank tidak
bertambah. Selisih ini muncul di Neraca.

Contoh (produksi, 30 Okt 2026): KAS2610300032 (id 668) KAS_UTAMA KELUAR Rp1.000.000
"Transfer ke BANK_UTAMA: TUKER TF" tanpa kaki masuk BANK_UTAMA.

Perbaikan: buat kaki masuk yang hilang (BANK_UTAMA MASUK, tanggal, nominal, dan
keterangan yang sama dengan kaki keluar), beri nomor grup TRF-<nomor> ke kedua kaki,
lalu hitung ulang saldo akun terkait.

Script TIDAK menebak: hanya id kaki keluar yang diminta (`--id`) yang diproses.
Tanpa --apply hanya menampilkan rencana.

Pemakaian (dari folder backend/):
    python scripts/fix_transfer_yatim.py --id 668
    python scripts/fix_transfer_yatim.py --id 668 --apply
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal  # noqa: E402
from app.models.keuangan import KasBank  # noqa: E402
from app.schemas.keuangan import KasBankCreate  # noqa: E402
from app.services.kas_bank_service import KasBankService  # noqa: E402
from app.utils.constants import KasBankJenis, KasBankSource, KasBankType  # noqa: E402


def cari_kaki_masuk_pasangan(db, keluar: KasBank):
    """Kaki masuk yang seharusnya pasangan kaki keluar ini (keterangan dan nominal sama)."""
    ke = keluar.keterangan.split("Transfer ke ", 1)[1].split(": ", 1)[0]
    ket_inti = keluar.keterangan.split(": ", 1)[1]
    return (
        db.query(KasBank)
        .filter(
            KasBank.jenis == KasBankJenis(ke),
            KasBank.tipe == KasBankType.MASUK,
            KasBank.nominal == keluar.nominal,
            KasBank.tanggal == keluar.tanggal,
            KasBank.keterangan == f"Transfer dari {keluar.jenis.value}: {ket_inti}",
        )
        .first()
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--id", type=int, required=True, help="id kaki keluar yang yatim")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        keluar = db.query(KasBank).filter(KasBank.id == args.id).first()
        if keluar is None:
            print(f"id {args.id} tidak ditemukan")
            return 1
        if keluar.tipe != KasBankType.KELUAR or not keluar.keterangan.startswith("Transfer ke "):
            print(f"id {args.id} bukan kaki keluar transfer: {keluar.keterangan!r}")
            return 1
        if keluar.nomor_referensi:
            print(f"id {args.id} sudah punya nomor_referensi {keluar.nomor_referensi}; tidak diubah")
            return 1
        if cari_kaki_masuk_pasangan(db, keluar) is not None:
            print(f"id {args.id} sudah punya kaki masuk; tidak perlu diperbaiki")
            return 0

        ke = KasBankJenis(keluar.keterangan.split("Transfer ke ", 1)[1].split(": ", 1)[0])
        print(f"Kaki keluar : id={keluar.id} {keluar.nomor_transaksi} {keluar.jenis.value} "
              f"{keluar.tanggal} Rp{keluar.nominal} {keluar.keterangan!r}")
        print(f"Kaki masuk yang akan dibuat: {ke.value} MASUK Rp{keluar.nominal} tanggal {keluar.tanggal}")
        if not args.apply:
            print("Dry run. Tambahkan --apply untuk menjalankan.")
            return 0

        service = KasBankService(db)
        grup = f"TRF-{keluar.nomor_transaksi}"
        masuk = service.create(
            KasBankCreate(
                tanggal=keluar.tanggal,
                jenis=ke,
                tipe=KasBankType.MASUK,
                nominal=keluar.nominal,
                sumber=KasBankSource.LAINNYA,
                keterangan=f"Transfer dari {keluar.jenis.value}: {keluar.keterangan.split(': ', 1)[1]}",
            ),
            None,
            commit=False,
            cek_duplikat=False,
        )
        keluar.nomor_referensi = grup
        masuk.nomor_referensi = grup
        db.flush()
        hasil = service.rebuild_balances(ke)
        db.commit()
        print(f"Selesai: kaki masuk {masuk.nomor_transaksi} dibuat, grup {grup}. Rebuild: {hasil}")
        return 0
    except Exception as e:
        db.rollback()
        print(f"Gagal, tidak ada perubahan: {e}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
