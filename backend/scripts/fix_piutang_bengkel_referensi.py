"""
Script: ikat piutang bengkel lama ke transaksi asalnya, dan samakan status transaksi
bila piutangnya sudah LUNAS.

Bug: piutang dari transaksi bengkel yang belum bayar saat dibuat disimpan dengan
referensi_id kosong. Pelunasan dari menu Piutang tidak menemukan transaksi asal,
sehingga status transaksi di Antrian tetap BELUM LUNAS.

Yang dilakukan (hanya piutang BENGKEL dengan referensi_id kosong):
- referensi_id diisi id transaksi yang nomor_transaksi-nya = nomor_referensi piutang.
- Jika piutang LUNAS dan transaksi belum LUNAS: status_bayar = LUNAS dan
  jumlah_bayar = grand_total.
- Piutang SEBAGIAN/BELUM_LUNAS hanya dilaporkan, tidak diubah, karena jumlah_bayar
  transaksi tidak bisa ditentukan dari data piutang saja.

Pemakaian (dari folder backend/):
    python scripts/fix_piutang_bengkel_referensi.py --nama "AKAS ALAM"
    python scripts/fix_piutang_bengkel_referensi.py --nama "AKAS ALAM" --apply
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal  # noqa: E402
from app.models.bengkel import TransaksiPenjualanBengkel  # noqa: E402
from app.models.keuangan import PiutangUsaha  # noqa: E402
from app.utils.constants import PaymentStatus, PiutangSource, PiutangStatus  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--nama", help="filter nama debitur (tidak peka huruf besar/kecil)")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        query = db.query(PiutangUsaha).filter(
            PiutangUsaha.sumber == PiutangSource.BENGKEL,
            PiutangUsaha.referensi_id.is_(None),
            PiutangUsaha.nomor_referensi.isnot(None),
            PiutangUsaha.status != PiutangStatus.BATAL,
        )
        if args.nama:
            query = query.filter(PiutangUsaha.nama_debitur.ilike(f"%{args.nama}%"))
        piutang_list = query.order_by(PiutangUsaha.id).all()
        if not piutang_list:
            print("Tidak ada piutang bengkel yang perlu diikat.")
            return 0

        rencana = []
        for p in piutang_list:
            trx = db.query(TransaksiPenjualanBengkel).filter(
                TransaksiPenjualanBengkel.nomor_transaksi == p.nomor_referensi
            ).first()
            if trx is None:
                print(f"LEWATI {p.nomor_piutang}: transaksi {p.nomor_referensi} tidak ditemukan")
                continue
            ubah_status = p.status == PiutangStatus.LUNAS and trx.status_bayar != PaymentStatus.LUNAS
            rencana.append((p, trx, ubah_status))
            print(f"{p.nomor_piutang} {p.nama_debitur} status={p.status.value} sisa={p.sisa_piutang} "
                  f"-> {trx.nomor_transaksi} (id={trx.id}) status_bayar={trx.status_bayar.value} "
                  f"grand_total={trx.grand_total}"
                  + (" | status transaksi akan jadi LUNAS" if ubah_status else "")
                  + ("" if p.status == PiutangStatus.LUNAS else " | perlu dicek manual (belum LUNAS)"))

        if not args.apply:
            print(f"Dry run: {len(rencana)} piutang akan diikat. Tambahkan --apply untuk menjalankan.")
            return 0

        for p, trx, ubah_status in rencana:
            p.referensi_id = trx.id
            if ubah_status:
                trx.status_bayar = PaymentStatus.LUNAS
                trx.jumlah_bayar = trx.grand_total
        db.commit()
        print(f"Selesai: {len(rencana)} piutang diikat ke transaksi asal.")
        return 0
    except Exception as e:
        db.rollback()
        print(f"Gagal, tidak ada perubahan: {e}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
