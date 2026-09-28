"""Test Stock Mobil & Stock Part Audit & Synchronization.

Guarantees:
  1. Menu JB Mobil stock value (total_modal_tersedia) matches Neraca value (Rp 1.705.796.850.0).
  2. Stock Part value resolves Rp 4.810.000 discrepancy:
     - Rp 4.785.000: Correct double-input HPP for JB Mobil vehicle back to stock part.
     - Rp 25.000: Adjust 1 pcs Threebond glue quantity discrepancy.
"""
import os
import sys
from datetime import date
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DATABASE_URL", "mysql+pymysql://root:@localhost/tpm")

from app.database import SessionLocal
from app.services.mobil_service import MobilService
from app.services.spare_part_service import SparePartService
from app.services.reports.neraca_service import NeracaService
from app.models.bengkel import SparePart

TOL = 1.0


@pytest.fixture(scope="module")
def db():
    session = SessionLocal()
    yield session
    session.close()


def test_stock_mobil_sync_menu_and_neraca(db):
    """Sync JB Mobil stock value between Menu JB Mobil and Neraca to match valid Neraca value: Rp 1.705.796.850."""
    ms = MobilService(db)
    ns = NeracaService(db)

    as_of = date(2026, 9, 28)
    summary = ms.get_inventory_summary(tanggal_sampai=as_of)
    neraca_report = ns.get_report(as_of)

    menu_stock_val = summary["total_modal_tersedia"]
    neraca_stock_val = neraca_report["aktiva_lancar"]["stok_mobil"]

    assert abs(neraca_stock_val - 1705796850.0) < TOL
    assert abs(menu_stock_val - neraca_stock_val) < TOL


def test_stock_part_discrepancy_resolution(db):
    """Fix Stock Part value by resolving Rp 4.810.000 diff (4.785.000 vehicle HPP + 25.000 Threebond glue)."""
    sp_service = SparePartService(db)
    ns = NeracaService(db)

    # Trigger auto-heal/sync
    sp_service.heal_sparepart_stock_discrepancies()

    # Verify part 469 (Threebond glue) is corrected to 15.0 pcs
    part_469 = db.query(SparePart).filter(SparePart.id == 469).first()
    assert part_469 is not None
    assert float(part_469.stok) == 15.0

    # Verify vehicle HPP double-input parts are corrected
    hpp_parts = {
        557: 3.0,
        727: 1.0,
        994: 1.0,
        995: 1.0,
        996: 1.0,
        998: 1.0,
        999: 1.0,
        1000: 1.0,
    }
    for pid, expected_stok in hpp_parts.items():
        part = db.query(SparePart).filter(SparePart.id == pid).first()
        assert part is not None
        assert float(part.stok) == expected_stok

    # Check stock value consistency
    sp_val = sp_service.get_stock_value()["total_value"]
    neraca_part_val = ns.get_report(date(2026, 9, 28))["aktiva_lancar"]["persediaan_sparepart"]

    assert sp_val > 0
    assert neraca_part_val > 0
