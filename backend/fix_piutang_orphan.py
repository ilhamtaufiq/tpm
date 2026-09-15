"""Backfill PembayaranPiutang utk piutang yg LUNAS tanpa baris pembayaran.

Dipakai sekali setelah fix update_payment (transaksi_bengkel_service).
Dry-run default; pakai --apply utk menulis.

Usage: python fix_piutang_orphan.py [--apply]
"""
import sys
from datetime import date
from app.database.connection import SessionLocal
from app.models.keuangan import PiutangUsaha, PembayaranPiutang
from app.models.bengkel import TransaksiPenjualanBengkel
from sqlalchemy import func

apply = "--apply" in sys.argv
db = SessionLocal()
try:
    paid_sq = (
        db.query(PembayaranPiutang.piutang_id, func.sum(PembayaranPiutang.nominal).label("p"))
        .group_by(PembayaranPiutang.piutang_id)
        .subquery()
    )
    rows = (
        db.query(PiutangUsaha, func.coalesce(paid_sq.c.p, 0))
        .outerjoin(paid_sq, paid_sq.c.piutang_id == PiutangUsaha.id)
        .filter(PiutangUsaha.total_dibayar > 0)
        .filter(PiutangUsaha.is_internal != True)
        .filter(PiutangUsaha.sumber == "BENGKEL")
        .all()
    )
    bad = [(pu, float(p)) for pu, p in rows if abs(float(pu.total_dibayar) - float(p)) >= 1]
    print(f"ORPHAN bengkel: {len(bad)}  (apply={apply})")
    for pu, paid in bad:
        gap = float(pu.total_dibayar) - paid
        trx = db.query(TransaksiPenjualanBengkel).filter(
            TransaksiPenjualanBengkel.nomor_transaksi == pu.nomor_referensi
        ).first()
        metode = trx.metode_bayar if trx else None
        # Tanggal kas masuk (bukan tanggal nota): kas pelunasan dicatat saat uang
        # diterima. Pakai nota → piutang turun sehari sebelum kas naik → selisih
        # harian baru. tanggal_lunas diisi tepat saat settle.
        tanggal = pu.tanggal_lunas or (trx.tanggal if trx else pu.tanggal)
        print(f"  #{pu.id} {pu.nomor_piutang} gap={gap:,.0f} metode={metode} tgl={tanggal}")
        if apply:
            db.add(PembayaranPiutang(
                piutang_id=pu.id,
                tanggal=tanggal,
                nominal=gap,
                metode_bayar=metode,
                catatan=f"BACKFILL pelunasan {pu.nomor_piutang} (kas lama tanpa record piutang)",
            ))
    if apply and bad:
        db.commit()
        print("committed.")
finally:
    db.close()
