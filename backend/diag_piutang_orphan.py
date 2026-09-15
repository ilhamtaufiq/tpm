"""Piutang yg punya total_dibayar > 0 tapi TANPA baris PembayaranPiutang.

Baris seperti ini membuat laporan (nominal - Σ PembayaranPiutang) overstated.

Usage: python diag_piutang_orphan.py
"""
from app.database.connection import SessionLocal
from app.models.keuangan import PiutangUsaha, PembayaranPiutang
from sqlalchemy import func

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
        .all()
    )
    bad = [(pu, float(p)) for pu, p in rows if abs(float(pu.total_dibayar) - float(p)) >= 1]
    print(f"total piutang dgn total_dibayar>0 (external): {len(rows)}")
    print(f"ORPHAN (total_dibayar != sum PembayaranPiutang): {len(bad)}")
    gap_total = 0.0
    for pu, p in sorted(bad, key=lambda x: x[0].tanggal):
        gap = float(pu.total_dibayar) - p
        gap_total += gap
        print(f"  #{pu.id} {pu.nomor_piutang} tgl={pu.tanggal} src={pu.sumber.value:14s} "
              f"unit={pu.unit.value if pu.unit else None:18s} "
              f"nominal={float(pu.nominal_piutang):>13,.0f} dibayar={float(pu.total_dibayar):>13,.0f} "
              f"sum_pays={p:>13,.0f} gap={gap:>13,.0f} status={pu.status.value}")
    print(f"\nTOTAL GAP: {gap_total:,.0f}")
finally:
    db.close()
