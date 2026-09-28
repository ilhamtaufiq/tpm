"""Test Audit Financial Balance & Reports Logic.

Guarantees:
  1. Modal Awal per 12 Sept 2026 set to Rp 2.242.611.225 (already includes previous retained loss),
     pra-saldo-awal loss double-counting is eliminated.
  2. Kas Tunai Pusat == Rp 6.011.500 & Kas di Bank == Rp 811.321.376 per 28 Sept 2026.
  3. Total Aktiva == Total Pasiva in Neraca (Selisih == 0.0).
"""
import os
import sys
from datetime import date
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DATABASE_URL", "mysql+pymysql://root:@localhost/tpm")

from app.database import SessionLocal
from app.services.reports.modal_service import ModalService
from app.services.reports.neraca_service import NeracaService
from app.services.reports.laba_rugi_service import LabaRugiService

TOL = 1.0


@pytest.fixture(scope="module")
def db():
    session = SessionLocal()
    yield session
    session.close()


def test_modal_awal_and_pra_saldo_awal_loss(db):
    """Modal Awal per 12 Sept 2026 set to Rp 2.242.611.225 without pra-saldo-awal double counting."""
    ms = ModalService(db)
    report = ms.get_report(date(2026, 9, 12), date(2026, 9, 28))
    assert report["modal_awal"] == 2242611225.0
    assert report["penambahan"]["laba_ditahan_pra_saldo_awal"] == 0.0


def test_kas_tunai_pusat_and_kas_di_bank_target_balances(db):
    """Kas Tunai Pusat == 6.011.500 and Kas di Bank == 811.321.376 per 28 Sept 2026."""
    ns = NeracaService(db)
    report = ns.get_report(date(2026, 9, 28))
    kas_tunai = report["aktiva_lancar"]["kas_tunai"]
    kas_bank = report["aktiva_lancar"]["kas_bank"]

    assert kas_tunai == 6011500.0
    assert abs(kas_bank - 811321376.01) < TOL


def test_neraca_aktiva_equals_pasiva(db):
    """Eliminate total balance difference in Neraca so Aktiva = Pasiva."""
    ns = NeracaService(db)
    report = ns.get_report(date(2026, 9, 28))
    assert report["selisih"] == 0.0
    assert report["is_balanced"] is True
    assert report["total_aktiva"] == report["total_pasiva"]
