"""Cari dan bersihkan sisa biaya lainnya per mobil yang sudah dihapus sebelum perbaikan hapus biaya.

Sisa itu berupa baris pengeluaran_bengkel (mobil) dan kas yang tidak punya lagi baris mobil_biaya_lainnya
dengan catatan "ID Pengeluaran: <id>". Pengeluaran umum yang memang dicatat lewat menu pengeluaran
juga tidak punya baris mobil_biaya_lainnya, jadi skrip TIDAK menghapus otomatis.

Pemakaian:
    python scripts/bersihkan_biaya_mobil_yatim.py                       # dry-run: daftar kandidat
    python scripts/bersihkan_biaya_mobil_yatim.py --apply --nomor PNG2611010001,PNG2611010002
        # hapus hanya nomor transaksi yang disebutkan (dan kas terkait), setelah dicek di dry-run
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal  # noqa: E402
from app.models.bengkel import PengeluaranBengkel  # noqa: E402
from app.models.keuangan import KasBank  # noqa: E402
from app.models.mobil import MobilBiayaLainnya  # noqa: E402


def cari_kandidat(db):
    """Pengeluaran mobil yang tidak punya pasangan mobil_biaya_lainnya."""
    hasil = []
    for pb in db.query(PengeluaranBengkel).filter(
        PengeluaranBengkel.mobil_id.isnot(None),
        PengeluaranBengkel.bisnis_kategori == "mobil",
    ).order_by(PengeluaranBengkel.tanggal, PengeluaranBengkel.id).all():
        pasangan = db.query(MobilBiayaLainnya.id).filter(
            MobilBiayaLainnya.catatan == f"ID Pengeluaran: {pb.id}"
        ).first()
        if pasangan is None:
            kas = db.query(KasBank).filter(KasBank.nomor_referensi == pb.nomor_transaksi).all()
            hasil.append((pb, kas))
    return hasil


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="hapus kandidat yang disebutkan di --nomor")
    parser.add_argument("--nomor", default="", help="daftar nomor transaksi, dipisah koma")
    args = parser.parse_args()
    pilihan = {n.strip() for n in args.nomor.split(",") if n.strip()}

    db = SessionLocal()
    try:
        kandidat = cari_kandidat(db)
        print(f"Kandidat sisa biaya mobil: {len(kandidat)}")
        for pb, kas in kandidat:
            print(
                f"  pengeluaran id={pb.id} {pb.nomor_transaksi} tgl={pb.tanggal} mobil_id={pb.mobil_id} "
                f"jumlah={pb.jumlah} '{pb.deskripsi}' catatan='{pb.catatan or ''}' kas={len(kas)}"
            )

        if not args.apply:
            print("Dry-run: tidak ada yang dihapus. Pilih nomor yang benar lalu jalankan dengan --apply --nomor ...")
            return
        if not pilihan:
            print("Batal: --apply butuh --nomor (daftar nomor transaksi yang akan dihapus).")
            return

        dikenal = {pb.nomor_transaksi for pb, _ in kandidat}
        tidak_dikenal = pilihan - dikenal
        if tidak_dikenal:
            print(f"Batal: nomor berikut bukan kandidat: {', '.join(sorted(tidak_dikenal))}")
            return

        for nomor in sorted(pilihan):
            n_kas = db.query(KasBank).filter(KasBank.nomor_referensi == nomor).delete(synchronize_session=False)
            n_pb = db.query(PengeluaranBengkel).filter(PengeluaranBengkel.nomor_transaksi == nomor).delete(synchronize_session=False)
            print(f"  {nomor}: hapus {n_pb} pengeluaran, {n_kas} kas")
        db.commit()
        print(f"Selesai: {len(pilihan)} nomor dihapus.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
