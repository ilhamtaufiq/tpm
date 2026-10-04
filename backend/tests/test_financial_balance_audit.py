"""Test Audit Financial Balance & Reports Logic.

Dulu tes ini mematok angka produksi periode 1 (Modal Awal 12 Sep, Kas Tunai
Rp6.011.500 per 29 Sep) sehingga gagal di DB mana pun selain snapshot 28 Sep —
termasuk setelah reset + import saldo awal periode berikutnya. Kini menjaga
invariant yang berlaku untuk data apa pun:
  1. Modal Awal beku: sama untuk semua periode; Rp2.242.611.225 hanya bila
     saldo awal = 2026-09-12; tidak ada "laba ditahan pra-saldo-awal".
  2. Kas & Bank Neraca == Σ mutasi KasBank (masuk − keluar) s/d tanggal laporan.
  3. Total Aktiva == Total Pasiva di Neraca.
"""
import os
import sys
from datetime import date
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DATABASE_URL", "mysql+pymysql://root:@localhost/tpm")

from sqlalchemy import case, func  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.models.keuangan import KasBank  # noqa: E402
from app.services.reports.modal_service import ModalService  # noqa: E402
from app.services.reports.neraca_service import NeracaService  # noqa: E402
from app.utils.constants import KasBankType  # noqa: E402

TOL = 1.0


@pytest.fixture(scope="module")
def db():
    session = SessionLocal()
    yield session
    session.close()


def _akhir(db):
    anchor = ModalService(db)._saldo_awal_date() or date.today()
    return max(date.today(), anchor)


def test_modal_awal_beku_dan_tanpa_pra_saldo_awal(db):
    ms = ModalService(db)
    anchor = ms._saldo_awal_date()
    if anchor is None:
        pytest.skip("belum ada saldo awal impor")
    akhir = _akhir(db)
    penuh = ms.get_report(anchor, akhir)
    sehari = ms.get_report(akhir, akhir)
    assert penuh["modal_awal_as_of"] == anchor.isoformat()
    assert abs(penuh["modal_awal"] - sehari["modal_awal"]) < TOL, "modal awal bergeser antar periode"
    assert penuh["penambahan"]["laba_ditahan_pra_saldo_awal"] == 0.0
    override = ModalService.MODAL_AWAL_OVERRIDE.get(anchor.isoformat())
    if override is not None:
        assert penuh["modal_awal"] == override


def test_kas_neraca_sama_dengan_mutasi_kasbank(db):
    akhir = _akhir(db)
    al = NeracaService(db).get_report(akhir)["aktiva_lancar"]
    neraca_kas = al["kas_tunai"] + al["kas_bank"] + al["unit_cash"]
    masuk, keluar = db.query(
        func.coalesce(func.sum(case((KasBank.tipe == KasBankType.MASUK, KasBank.nominal), else_=0)), 0),
        func.coalesce(func.sum(case((KasBank.tipe == KasBankType.KELUAR, KasBank.nominal), else_=0)), 0),
    ).filter(KasBank.tanggal <= akhir).one()
    assert abs(neraca_kas - (float(masuk) - float(keluar))) < TOL


def test_neraca_aktiva_equals_pasiva(db):
    """Aktiva = Pasiva (selisih = 0) di Neraca."""
    report = NeracaService(db).get_report(_akhir(db))
    assert abs(report["selisih"]) < TOL
    assert report["is_balanced"] is True
    assert abs(report["total_aktiva"] - report["total_pasiva"]) < TOL
