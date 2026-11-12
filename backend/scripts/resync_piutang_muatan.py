"""Samakan piutang supir muatan jasa angkut yang belum lunas dengan bagian TPM terbaru.

Piutang supir dulu dihitung hanya saat muatan dibuat. Muatan yang diedit sesudahnya bisa
memiliki nominal piutang yang tidak sama dengan bagian TPM (laba_tpm - biaya operasional).
Skrip ini mencari selisih itu, lalu memakai logika yang sama dengan service muatan.

Pemakaian:
    python scripts/resync_piutang_muatan.py            # dry-run: hanya menampilkan
    python scripts/resync_piutang_muatan.py --apply    # simpan perubahan
"""
import argparse
import os
import sys
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import HTTPException  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.models.jasa_angkut import MuatanJasaAngkut  # noqa: E402
from app.models.keuangan import PiutangUsaha  # noqa: E402
from app.services.muatan_service import MuatanService  # noqa: E402
from app.utils.constants import PiutangSource, PiutangStatus, PaymentStatus  # noqa: E402


def rencana(db):
    """Daftar (muatan, piutang, nominal_baru) untuk piutang yang nominalnya tidak sesuai bagian TPM."""
    hasil = []
    piutang_list = db.query(PiutangUsaha).filter(
        PiutangUsaha.sumber == PiutangSource.JASA_ANGKUT,
        PiutangUsaha.status.in_([PiutangStatus.BELUM_LUNAS, PiutangStatus.SEBAGIAN]),
    ).all()
    for p in piutang_list:
        m = db.query(MuatanJasaAngkut).filter(MuatanJasaAngkut.nomor_transaksi == p.nomor_referensi).first()
        if m is None or m.status_bayar == PaymentStatus.LUNAS or m.id != p.referensi_id:
            continue
        biaya = sum((Decimal(str(b.jumlah)) for b in m.biaya_tambahan), Decimal("0"))
        baru = max(Decimal("0"), Decimal(str(m.laba_tpm)) - biaya)
        if baru != Decimal(str(p.nominal_piutang)):
            hasil.append((m, p, baru))
    return hasil


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="simpan perubahan (default: dry-run)")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        daftar = rencana(db)
        print(f"Piutang supir yang nominalnya tidak sesuai bagian TPM: {len(daftar)}")
        for m, p, baru in daftar:
            print(f"  muatan id={m.id} {m.nomor_transaksi}: piutang {p.nomor_piutang} '{p.nama_debitur}' "
                  f"{p.nominal_piutang} -> {baru} (dibayar {p.total_dibayar})")
        if not args.apply:
            print("Dry-run: tidak ada yang disimpan. Jalankan dengan --apply untuk menyimpan.")
            return

        service = MuatanService(db)
        berhasil, gagal = 0, 0
        for m, _p, _baru in daftar:
            try:
                biaya = sum((Decimal(str(b.jumlah)) for b in m.biaya_tambahan), Decimal("0"))
                service._sesuaikan_piutang_belum_lunas(m, biaya)
                db.commit()
                berhasil += 1
            except HTTPException as e:
                db.rollback()
                gagal += 1
                print(f"  DILEWATI muatan {m.nomor_transaksi}: {e.detail}")
        print(f"Disimpan: {berhasil}. Dilewati: {gagal}.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
