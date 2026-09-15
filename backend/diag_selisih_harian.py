"""Cari hari munculnya selisih modal (gap harian).

Usage: python diag_selisih_harian.py 2026-09-12 2026-09-30
"""
import sys
from datetime import date, timedelta
from app.database.connection import SessionLocal
from app.services.reports.modal_service import ModalService

dari = date.fromisoformat(sys.argv[1])
sampai = date.fromisoformat(sys.argv[2])

db = SessionLocal()
try:
    svc = ModalService(db)
    prev = None
    d = dari
    while d <= sampai:
        r = svc.get_report(dari, d)
        s = r["info"]["validasi"]["selisih"]
        if prev is None or abs(s - prev) >= 1:
            print(f"{d}  selisih={s:>15,.0f}  delta={0 if prev is None else s - prev:>15,.0f}")
        prev = s
        d += timedelta(days=1)
finally:
    db.close()
