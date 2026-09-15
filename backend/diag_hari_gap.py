"""Dump aktivitas piutang/kas pada hari munculnya selisih.

Usage: python diag_hari_gap.py 2026-09-15
"""
import sys
from datetime import date
from app.database.connection import SessionLocal
from app.models.keuangan import KasBank, PiutangUsaha, PembayaranPiutang

d = date.fromisoformat(sys.argv[1])
db = SessionLocal()
try:
    print(f"=== KasBank {d} ===")
    for k in db.query(KasBank).filter(KasBank.tanggal == d).order_by(KasBank.id).all():
        print(f"  #{k.id} {k.jenis.value:18s} {k.tipe.value:7s} {float(k.nominal):>14,.0f} "
              f"src={k.sumber.value:18s} {k.metode_bayar.value:8s} ref={k.nomor_referensi} | {k.keterangan}")

    print(f"\n=== PembayaranPiutang {d} ===")
    for p in db.query(PembayaranPiutang).filter(PembayaranPiutang.tanggal == d).all():
        pu = db.query(PiutangUsaha).get(p.piutang_id)
        print(f"  #{p.id} nominal={float(p.nominal):>14,.0f} metode={p.metode_bayar.value:8s} "
              f"piutang={pu.nomor_piutang} src={pu.sumber.value} "
              f"unit={pu.unit.value if pu.unit else None} internal={pu.is_internal} "
              f"ref_id={pu.referensi_id} | {pu.nama_debitur}")

    print(f"\n=== PiutangUsaha dibuat {d} ===")
    for pu in db.query(PiutangUsaha).filter(PiutangUsaha.tanggal == d).all():
        print(f"  #{pu.id} {pu.nomor_piutang} nominal={float(pu.nominal_piutang):>14,.0f} "
              f"dibayar={float(pu.total_dibayar):>14,.0f} sisa={float(pu.sisa_piutang):>14,.0f} "
              f"src={pu.sumber.value} unit={pu.unit.value if pu.unit else None} internal={pu.is_internal} "
              f"status={pu.status.value}")

    print(f"\n=== PiutangUsaha yang dibayar pada {d} ===")
    ids = [p.piutang_id for p in db.query(PembayaranPiutang).filter(PembayaranPiutang.tanggal == d).all()]
    for pu in db.query(PiutangUsaha).filter(PiutangUsaha.id.in_(ids)).all():
        print(f"  #{pu.id} {pu.nomor_piutang} nominal={float(pu.nominal_piutang):>14,.0f} "
              f"dibayar={float(pu.total_dibayar):>14,.0f} sisa={float(pu.sisa_piutang):>14,.0f} "
              f"src={pu.sumber.value} unit={pu.unit.value if pu.unit else None} internal={pu.is_internal} "
              f"ref_id={pu.referensi_id} status={pu.status.value} debit={pu.nama_debitur}")
finally:
    db.close()
