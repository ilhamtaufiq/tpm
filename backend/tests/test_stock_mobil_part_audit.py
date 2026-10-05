"""Test Stock Mobil & Stock Part Audit & Synchronization.

Dulu mematok angka produksi 28 Sep (stok mobil Rp1.705.796.850, part id 469 =
15 pcs) — gagal begitu ada transaksi/edit sah setelahnya atau setelah reset +
import ulang. Kini menjaga invariant yang berlaku untuk data apa pun:
  1. Nilai stok JB Mobil di menu == Neraca pada tanggal yang sama.
  2. Koreksi stok part 28 Sep (ID produksi) tidak pernah menyentuh part lain
     yang kebetulan memakai ID itu setelah import ulang.
"""
import os
import sys
from datetime import date
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DATABASE_URL", "mysql+pymysql://root:@localhost/tpm")

from app.database import SessionLocal  # noqa: E402
from app.models.bengkel import SparePart  # noqa: E402
from app.models.mobil import Mobil  # noqa: E402
from app.utils.constants import CarStatus  # noqa: E402
from app.models.system_setting import SystemSetting  # noqa: E402
from app.services.mobil_service import MobilService  # noqa: E402
from app.services.spare_part_service import SparePartService  # noqa: E402
from app.services.reports.neraca_service import NeracaService  # noqa: E402

TOL = 1.0
KATA_KUNCI = {
    469: "THREEBOND", 557: "PAKING DEKSEL", 727: "SIL AS KUPLING",
    994: "SLEEVE SYNCRO", 995: "SLEEVE SYNCRO", 996: "LAHER",
    998: "RING SEHER", 999: "BORING SET", 1000: "METAL JALAN",
}


@pytest.fixture(scope="module")
def db():
    session = SessionLocal()
    yield session
    session.close()


def test_stock_mobil_sync_menu_and_neraca(db):
    """Menu `total_modal_tersedia` hanya status TERSEDIA; Neraca juga memuat unit
    BOOKING (belum terjual = masih persediaan). Bandingkan pada himpunan yang sama."""
    as_of = date.today()
    menu = MobilService(db).get_inventory_summary(tanggal_sampai=as_of)["total_modal_tersedia"]
    al = NeracaService(db).get_report(as_of)["aktiva_lancar"]
    detail = al["stok_mobil_detail"]
    assert abs(sum(d["total"] for d in detail) - al["stok_mobil"]) < TOL
    tersedia = {
        m.id for m in db.query(Mobil).filter(
            Mobil.status == CarStatus.TERSEDIA, Mobil.deleted_at.is_(None)
        ).all()
    }
    neraca_tersedia = sum(d["total"] for d in detail if d["id"] in tersedia)
    assert abs(float(menu) - neraca_tersedia) < TOL


def test_heal_stok_part_tidak_menyentuh_part_lain(db):
    sp_service = SparePartService(db)
    flag = db.query(SystemSetting).filter(
        SystemSetting.key == sp_service.HEAL_STOCK_FLAG_KEY
    ).first()
    flag_ada = flag is not None
    if flag_ada:
        db.delete(flag)
        db.commit()
    lain = {
        sp.id: sp.stok
        for sp in db.query(SparePart).filter(SparePart.id.in_(KATA_KUNCI)).all()
        if KATA_KUNCI[sp.id] not in (sp.nama or "").upper()
    }
    try:
        sp_service.heal_sparepart_stock_discrepancies()
        db.expire_all()
        for pid, stok in lain.items():
            assert db.get(SparePart, pid).stok == stok, f"part {pid} ikut terpotong"
        assert db.query(SystemSetting).filter(
            SystemSetting.key == sp_service.HEAL_STOCK_FLAG_KEY
        ).first() is not None
    finally:
        if not flag_ada:
            row = db.query(SystemSetting).filter(
                SystemSetting.key == sp_service.HEAL_STOCK_FLAG_KEY
            ).first()
            if row is not None:
                db.delete(row)
                db.commit()


def test_neraca_info_nilai_daftar_stok_part(db):
    """Neraca menampilkan nilai daftar stok (stok x harga beli terbaru) di samping
    persediaan harga perolehan; selisihnya = revaluasi belum terealisasi dan
    sama dengan memo di bagian Modal. Info saja, total persediaan tidak berubah."""
    from app.utils.helpers import get_jakarta_date
    rep = NeracaService(db).get_report(get_jakarta_date())
    al = rep["aktiva_lancar"]
    belum = rep["modal"]["revaluasi_sparepart"]["belum_terealisasi"]
    assert abs(al["revaluasi_sparepart_belum_terealisasi"] - belum) < TOL
    assert abs(al["persediaan_sparepart_harga_terbaru"] - al["persediaan_sparepart"] - belum) < TOL
    daftar = sum(
        float(sp.stok or 0) * float(sp.harga_beli or 0)
        for sp in db.query(SparePart).filter(SparePart.deleted_at.is_(None)).all()
        if float(sp.stok or 0) > 0
    )
    assert abs(al["persediaan_sparepart_harga_terbaru"] - daftar) < TOL
