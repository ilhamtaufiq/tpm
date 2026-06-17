"""
Debug: Quick check selisih after fix
"""
import sys
sys.path.insert(0, '.')

from datetime import date
from app.database.connection import SessionLocal
from app.services.reports.modal_service import ModalService

db = SessionLocal()
try:
    svc = ModalService(db)
    report = svc.get_report(date(2026, 4, 1), date(2026, 4, 21))

    c = report['section_c']
    print(f"pembelian_mobil.cash: {c['pembelian_mobil']['cash']}")
    print(f"mobil_prep: {c['operasional_unit_details']['mobil_prep']}")
    print(f"TOTAL C: {c['total_c']}")

    a = report['section_a']
    print(f"\nsetoran_modal: {a['setoran_modal']}")
    print(f"total_laba: {a['total_laba']}")
    print(f"total_a: {a['total_a']}")

    d = report['section_d']
    print(f"\ntheoretical: {d['theoretical_modal']}")
    print(f"cash: {d['cash']}")
    print(f"selisih: {d['penyesuaian']}")

finally:
    db.close()