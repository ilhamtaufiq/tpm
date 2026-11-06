"""Catat stok awal spare part yang dibuat sesudah saldo awal tanpa jejak.

Masalah: part baru yang dibuat lewat Master Data (atau impor Excel) dengan stok awal tidak
punya catatan kapan stok itu masuk. Rumus stok mundur laporan (pembelian, pemakaian, retur,
koreksi) lalu menghitung stok itu seolah sudah ada sejak saldo awal, dan selisihnya muncul
sebagai "Penyesuaian Transaksi Backdate" di Perubahan Modal.

Perbaikan: untuk tiap part yang dibuat sesudah tanggal saldo awal, hitung stok "hantu" pada
sehari sebelum part dibuat. Bila positif, tambahkan koreksi qty (`is_qty_correction`)
bertanggal hari part dibuat. Idempoten: setelah diterapkan, stok hantu menjadi 0.

Pemakaian:
    python scripts/fix_stok_awal_part.py            # dry-run, hanya menampilkan
    python scripts/fix_stok_awal_part.py --apply    # simpan koreksi
"""
import argparse
import os
import sys
from datetime import timedelta
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import func  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.models.bengkel import (  # noqa: E402
    DetailPembelianSparePart,
    DetailReturPembelianSparePart,
    DetailTransaksiSpareParts,
    PembelianSparePart,
    ReturPembelianSparePart,
    SparePart,
    SparePartRevaluation,
    TransaksiPenjualanBengkel,
)
from app.services.reports.modal_service import ModalService  # noqa: E402
from app.utils.sparepart_stock import is_always_ready_stock  # noqa: E402
from app.utils.workshop_finance import workshop_finance_recognized_filters  # noqa: E402


def stok_hantu(db, sp, sebelum):
    """Qty yang dihitung rumus stok mundur pada tanggal `sebelum` (seharusnya 0 sebelum part dibuat)."""
    beli = db.query(func.sum(DetailPembelianSparePart.qty)).join(PembelianSparePart).filter(
        DetailPembelianSparePart.spare_part_id == sp.id, PembelianSparePart.tanggal > sebelum,
    ).scalar() or 0
    pakai = db.query(func.sum(DetailTransaksiSpareParts.qty)).join(TransaksiPenjualanBengkel).filter(
        *workshop_finance_recognized_filters(),
        DetailTransaksiSpareParts.spare_part_id == sp.id, TransaksiPenjualanBengkel.tanggal > sebelum,
    ).scalar() or 0
    retur = db.query(func.sum(DetailReturPembelianSparePart.qty)).join(
        ReturPembelianSparePart, DetailReturPembelianSparePart.retur_id == ReturPembelianSparePart.id,
    ).filter(
        DetailReturPembelianSparePart.spare_part_id == sp.id,
        ReturPembelianSparePart.tanggal > sebelum,
        ReturPembelianSparePart.dibatalkan == False,  # noqa: E712
    ).scalar() or 0
    koreksi = db.query(func.sum(SparePartRevaluation.qty_at_reval)).filter(
        SparePartRevaluation.spare_part_id == sp.id,
        SparePartRevaluation.is_qty_correction == True,  # noqa: E712
        SparePartRevaluation.tanggal > sebelum,
    ).scalar() or 0
    return Decimal(str(sp.stok or 0)) - Decimal(str(beli)) + Decimal(str(pakai)) + Decimal(str(retur)) - Decimal(str(koreksi))


def nilai_hantu(db, sp, sebelum):
    """Nilai yang dihitung rumus stok mundur laporan (base.py) untuk part ini pada tanggal `sebelum`."""
    sekarang = Decimal(str(sp.stok or 0)) * Decimal(str(sp.harga_beli or 0))
    beli = db.query(func.sum(DetailPembelianSparePart.subtotal)).join(PembelianSparePart).filter(
        DetailPembelianSparePart.spare_part_id == sp.id, PembelianSparePart.tanggal > sebelum,
    ).scalar() or 0
    pakai = db.query(func.sum(DetailTransaksiSpareParts.qty * DetailTransaksiSpareParts.harga_beli)).join(TransaksiPenjualanBengkel).filter(
        *workshop_finance_recognized_filters(),
        DetailTransaksiSpareParts.spare_part_id == sp.id, TransaksiPenjualanBengkel.tanggal > sebelum,
    ).scalar() or 0
    retur = db.query(func.sum(DetailReturPembelianSparePart.subtotal)).join(
        ReturPembelianSparePart, DetailReturPembelianSparePart.retur_id == ReturPembelianSparePart.id,
    ).filter(
        DetailReturPembelianSparePart.spare_part_id == sp.id,
        ReturPembelianSparePart.tanggal > sebelum,
        ReturPembelianSparePart.dibatalkan == False,  # noqa: E712
    ).scalar() or 0
    reval = db.query(func.sum(SparePartRevaluation.amount)).filter(
        SparePartRevaluation.spare_part_id == sp.id, SparePartRevaluation.tanggal > sebelum,
    ).scalar() or 0
    return sekarang - Decimal(str(beli)) + Decimal(str(pakai)) + Decimal(str(retur)) - Decimal(str(reval))


def gerakan_pertama(db, sp, sesudah):
    """Tanggal paling awal pembelian atau pemakaian part ini sesudah `sesudah`."""
    beli = db.query(func.min(PembelianSparePart.tanggal)).join(DetailPembelianSparePart).filter(
        DetailPembelianSparePart.spare_part_id == sp.id, PembelianSparePart.tanggal > sesudah,
    ).scalar()
    pakai = db.query(func.min(TransaksiPenjualanBengkel.tanggal)).join(DetailTransaksiSpareParts).filter(
        *workshop_finance_recognized_filters(),
        DetailTransaksiSpareParts.spare_part_id == sp.id, TransaksiPenjualanBengkel.tanggal > sesudah,
    ).scalar()
    tanggal = [t for t in (beli, pakai) if t is not None]
    return min(tanggal) if tanggal else None


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="simpan koreksi (default: dry-run)")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        svc = ModalService(db)
        anchor = svc._saldo_awal_date()
        if anchor is None:
            print("Tidak ada tanggal saldo awal. Tidak ada yang diubah.")
            return
        # Batas = saat saldo awal dibekukan (sesudah impor saldo awal). Part yang dibuat impor
        # saldo awal adalah stok pembuka dan tidak boleh dikoreksi.
        from app.models.system_setting import SystemSetting
        beku = db.query(SystemSetting).filter(SystemSetting.key == svc.FROZEN_MODAL_AWAL_KEY).first()
        if beku is not None and beku.updated_at is not None:
            batas = beku.updated_at
        else:
            from datetime import datetime, time
            batas = datetime.combine(anchor + timedelta(days=1), time.min)
        parts = db.query(SparePart).filter(
            SparePart.deleted_at.is_(None),
            SparePart.created_at > batas,
        ).all()
        total = Decimal("0")
        lewati_negatif = []
        rencana = []
        for sp in parts:
            if is_always_ready_stock(sp.stok):
                continue
            dibuat = sp.created_at.date()
            # Stok hantu dihitung pada tanggal saldo awal (posisi yang dibekukan). Koreksi diberi
            # tanggal gerakan pertama part itu sesudah saldo awal, atau hari dibuat bila lebih awal,
            # supaya transaksi yang tanggalnya sebelum part dibuat (backdate) ikut tertutup.
            qty = stok_hantu(db, sp, anchor)
            pertama = gerakan_pertama(db, sp, anchor)
            if pertama is not None and pertama < dibuat:
                dibuat = pertama
            if qty == 0:
                continue
            if qty < 0:
                lewati_negatif.append((sp.id, sp.nama, qty))
                continue
            harga = Decimal(str(sp.harga_beli or 0))
            # Nilai = persis yang dihitung laporan (pemakaian memakai harga beli saat transaksi),
            # supaya koreksi menutup stok hantu tanpa sisa.
            nilai = nilai_hantu(db, sp, anchor)
            total += nilai
            rencana.append((sp, dibuat, qty, harga, nilai))

        print(f"Tanggal saldo awal: {anchor}, batas pembekuan: {batas}. Part dibuat sesudahnya: {len(parts)}.")
        for sp, dibuat, qty, harga, nilai in rencana:
            print(f"  id={sp.id} {sp.nama[:40]:40s} dibuat {dibuat} qty {qty} x {harga:,.0f} = {nilai:,.0f}")
        print(f"Total stok awal tanpa jejak: Rp{total:,.0f} ({len(rencana)} part)")
        for pid, nama, qty in lewati_negatif:
            print(f"  DILEWATI id={pid} {nama[:40]}: qty {qty} negatif, perlu dicek manual")

        if not args.apply:
            print("Dry-run: tidak ada yang disimpan. Jalankan dengan --apply untuk menyimpan.")
            return
        for sp, dibuat, qty, harga, nilai in rencana:
            db.add(SparePartRevaluation(
                spare_part_id=sp.id, tanggal=dibuat, qty_at_reval=qty,
                harga_lama=harga, harga_baru=harga, amount=nilai, is_qty_correction=True,
            ))
        db.commit()
        print(f"Disimpan: {len(rencana)} koreksi stok awal.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
