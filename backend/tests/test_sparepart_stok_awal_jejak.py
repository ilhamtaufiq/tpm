"""Stok awal part baru tercatat sebagai koreksi qty, jadi laporan historis tidak menghitungnya mundur.

Kasus produksi: part dibuat di Master Data dengan stok awal (bukan lewat pembelian), lalu
terjual. Tanpa jejak, persediaan di tanggal saldo awal ikut berisi stok itu dan selisihnya
muncul sebagai "Penyesuaian Transaksi Backdate" di Perubahan Modal.
"""
from datetime import timedelta
from decimal import Decimal

import pytest

from app.database import SessionLocal
from app.models.bengkel import SparePart, SparePartRevaluation
from app.schemas.bengkel import SparePartCreate
from app.services.reports.neraca_service import NeracaService
from app.services.spare_part_service import SparePartService
from app.utils.helpers import get_jakarta_date

NAMA = "UJI STOK AWAL JEJAK"


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.rollback()
    ids = [p.id for p in session.query(SparePart).filter(SparePart.nama == NAMA).all()]
    if ids:
        session.query(SparePartRevaluation).filter(SparePartRevaluation.spare_part_id.in_(ids)).delete(synchronize_session=False)
        session.query(SparePart).filter(SparePart.id.in_(ids)).delete(synchronize_session=False)
    session.commit()
    session.close()


def test_part_baru_mencatat_koreksi_stok_awal(db):
    sp = SparePartService(db).create(SparePartCreate(nama=NAMA, stok=Decimal("3"), harga_beli=Decimal("10000")))
    koreksi = db.query(SparePartRevaluation).filter(
        SparePartRevaluation.spare_part_id == sp.id, SparePartRevaluation.is_qty_correction == True,  # noqa: E712
    ).all()
    assert len(koreksi) == 1
    assert koreksi[0].qty_at_reval == Decimal("3")
    assert koreksi[0].amount == Decimal("30000")
    assert koreksi[0].tanggal == get_jakarta_date()


def test_part_tanpa_stok_tidak_mencatat_koreksi(db):
    sp = SparePartService(db).create(SparePartCreate(nama=NAMA, stok=Decimal("0"), harga_beli=Decimal("10000")))
    assert db.query(SparePartRevaluation).filter(SparePartRevaluation.spare_part_id == sp.id).count() == 0


def test_persediaan_kemarin_tidak_berisi_stok_part_baru(db):
    hari_ini = get_jakarta_date()
    kemarin = hari_ini - timedelta(days=1)
    sebelum_kemarin = NeracaService(db).get_report(kemarin)["aktiva_lancar"]["persediaan_sparepart"]
    sebelum_hari_ini = NeracaService(db).get_report(hari_ini)["aktiva_lancar"]["persediaan_sparepart"]
    SparePartService(db).create(SparePartCreate(nama=NAMA, stok=Decimal("3"), harga_beli=Decimal("10000")))
    db.expire_all()
    assert NeracaService(db).get_report(kemarin)["aktiva_lancar"]["persediaan_sparepart"] == pytest.approx(sebelum_kemarin)
    assert NeracaService(db).get_report(hari_ini)["aktiva_lancar"]["persediaan_sparepart"] == pytest.approx(sebelum_hari_ini + 30000)
