"""Laba Rugi dan Perubahan Modal harus memakai aliran keuangan yang konsisten.

Regresi yang dijaga:
  1. Rekap Laba Rugi foot: revenue − hpp − beban_unit − beban_pusat == laba_operasional
     (dulu total_beban_operasional & total_beban_umum berisi angka SAMA → overhead pusat
      terhitung dua kali dan rekap tak pernah nyambung ke laba_operasional).
  2. Aliran ekuitas di UI Perubahan Modal == modal_akhir − modal_awal
     (dulu prive dikurangkan dua kali karena laba_bersih sudah net prive).
  3. LR == Modal bila periode dimulai >= posisi pembuka; boleh berbeda bila periode
     menjangkau sebelum posisi pembuka (mutasi kumulatif) — backend menandainya lewat
     modal_awal_flow_dari.

Jalankan: cd backend && venv/Scripts/python.exe -m pytest tests/test_laporan_aliran_modal_vs_laba_rugi.py -q
"""
import os
import sys
from datetime import date

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DATABASE_URL", "mysql+pymysql://root:@localhost/tpm")

from app.database import SessionLocal  # noqa: E402
from app.services.reports.laba_rugi_service import LabaRugiService  # noqa: E402
from app.services.reports.modal_service import ModalService  # noqa: E402

TOL = 1.0  # pembulatan float


@pytest.fixture(scope="module")
def db():
    session = SessionLocal()
    yield session
    session.close()


def _reports(db, dari, sampai):
    lr = LabaRugiService(db).get_report(dari, sampai)["summary"]
    md = ModalService(db).get_report(dari, sampai)
    return lr, md


def test_rekap_laba_rugi_foot(db):
    """Σ baris rekap = laba_operasional, tanpa double-count overhead pusat."""
    anchor = ModalService(db)._saldo_awal_date() or date(2026, 9, 12)
    lr, _ = _reports(db, anchor, date(2026, 9, 18))
    rekap = (
        lr["total_revenue"]
        - lr["total_hpp"]
        - lr["total_beban_operasional"]
        - lr["total_beban_umum"]
    )
    assert abs(rekap - lr["laba_operasional"]) < TOL, (
        f"rekap {rekap:,.0f} != laba_operasional {lr['laba_operasional']:,.0f}"
    )
    # Beban unit dan beban pusat harus BERBEDA — kalau sama, salah satunya salah isi.
    assert lr["total_beban_operasional"] != lr["total_beban_umum"]


def test_aliran_modal_sama_dengan_delta_modal(db):
    """Aliran ekuitas (setoran + laba ops − prive) == modal_akhir − modal_awal."""
    anchor = ModalService(db)._saldo_awal_date() or date(2026, 9, 12)
    _, md = _reports(db, anchor, date(2026, 9, 18))
    setoran = md["penambahan"].get("setoran_modal") or 0
    nonkas = (md["penambahan"].get("modal_non_kas") or {}).get("total") or 0
    prive = (md["pengurangan"].get("prive") or 0) + (
        md["pengurangan"].get("pengembalian_modal") or 0
    )
    aliran = setoran + nonkas + (md["info"].get("laba_operasional") or 0) - prive
    assert abs(aliran - (md["modal_akhir"] - md["modal_awal"])) < TOL, (
        "prive kemungkinan terhitung dua kali (laba_bersih sudah net prive)"
    )


def test_lr_sama_dengan_modal_pada_periode_pasca_pembuka(db):
    anchor = ModalService(db)._saldo_awal_date() or date(2026, 9, 12)
    lr, md = _reports(db, anchor, date(2026, 9, 18))
    assert abs(lr["laba_operasional"] - (md["info"].get("laba_operasional") or 0)) < TOL
    assert md.get("modal_awal_flow_dari") == anchor.isoformat()


def test_flow_dari_menandai_periode_pra_pembuka(db):
    """Periode sebelum posisi pembuka → mutasi kumulatif, UI wajib diberi tahu."""
    anchor = ModalService(db)._saldo_awal_date()
    if not anchor or anchor <= date(2026, 9, 1):
        pytest.skip("posisi pembuka tidak menjangkau periode uji")
    lr, md = _reports(db, date(2026, 9, 1), date(2026, 9, 18))
    assert md["modal_awal_flow_dari"] == anchor.isoformat()
    assert md["modal_awal_flow_dari"] > date(2026, 9, 1).isoformat()
    # Justru INI yang harus berbeda — dan alasannya terungkap lewat flow_dari.
    assert abs(lr["laba_operasional"] - (md["info"].get("laba_operasional") or 0)) >= TOL


def test_tidak_ada_field_unit_yang_dijumlah_ganda(db):
    """Ringkasan backend harus foot tanpa menjumlah ulang field per unit.

    Konsumen (finance/laporan.tsx) dulu menurunkan sendiri:
      labaKotor = b.laba_kotor + (m.revenue - m.hpp - m.beban_ops - m.maintenance) + ja.revenue
      totalBeban = pusat + b.* + ja.* + m.*
    Keduanya ganda-hitung `ja.maintenance` (sudah ada di ja_laba_kotor) dan
    komponen b_ops/gaji/lembur (sudah ada di laba bersih unit). Test ini menjaga
    agar ringkasan tetap konsisten sehingga tak ada alasan menurunkan ulang.
    """
    anchor = ModalService(db)._saldo_awal_date() or date(2026, 9, 12)
    lr, _ = _reports(db, anchor, date(2026, 9, 18))
    u = LabaRugiService(db).get_report(anchor, date(2026, 9, 18))["units"]

    # total_laba_kotor harus == Σ laba_kotor unit (tanpa pembentukan ulang di klien).
    assert abs(lr["total_laba_kotor"] - sum(u[k]["laba_kotor"] for k in u)) < TOL

    # Beban unit harus mencakup pengurang laba kotor tiap unit — bukan sekadar
    # menjumlah beban_operasional mentah (yang tak termasuk JA overhead / mobil prep).
    assert abs(
        (lr["total_laba_kotor"] - sum(u[k]["laba_bersih"] for k in u))
        - lr["total_beban_operasional"]
    ) < TOL

    # Rekap foot dengan nilai backend apa adanya.
    assert abs(
        lr["total_revenue"]
        - lr["total_hpp"]
        - lr["total_beban_operasional"]
        - lr["total_beban_umum"]
        - lr["laba_operasional"]
    ) < TOL
