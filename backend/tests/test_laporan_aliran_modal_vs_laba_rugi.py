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
from datetime import date, timedelta

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


def _periode(db):
    """Posisi pembuka aktif s/d hari ini — berlaku untuk data periode mana pun."""
    anchor = ModalService(db)._saldo_awal_date() or date.today()
    return anchor, max(date.today(), anchor)


def _reports(db, dari, sampai):
    lr = LabaRugiService(db).get_report(dari, sampai)["summary"]
    md = ModalService(db).get_report(dari, sampai)
    return lr, md


def test_rekap_laba_rugi_foot(db):
    """Σ baris rekap = laba_operasional, tanpa double-count overhead pusat."""
    anchor, akhir = _periode(db)
    lr, _ = _reports(db, anchor, akhir)
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
    # (Keduanya 0 = belum ada beban sama sekali, mis. tepat setelah import.)
    if lr["total_beban_operasional"] or lr["total_beban_umum"]:
        assert lr["total_beban_operasional"] != lr["total_beban_umum"]


def test_aliran_modal_sama_dengan_delta_modal(db):
    """Aliran ekuitas (setoran + laba ops − prive) == modal_akhir − modal_awal."""
    anchor, akhir = _periode(db)
    _, md = _reports(db, anchor, akhir)
    setoran = md["penambahan"].get("setoran_modal") or 0
    nonkas = (md["penambahan"].get("modal_non_kas") or {}).get("total") or 0
    prive = (md["pengurangan"].get("prive") or 0) + (
        md["pengurangan"].get("pengembalian_modal") or 0
    )
    pra_saldo_awal = (
        md["penambahan"].get("laba_ditahan_pra_saldo_awal")
        or md["penambahan"].get("penyesuaian_backdate_non_impor")
        or 0
    )
    reval_reserve = md["penambahan"].get("penyesuaian_harga_beli_sparepart") or 0
    sebelumnya = (md["info"].get("laba_ditahan_sebelumnya") or 0) + (md.get("mutasi_modal_sebelumnya") or 0)
    aliran = setoran + nonkas + pra_saldo_awal + reval_reserve + sebelumnya + (md["info"].get("laba_operasional") or 0) - prive
    assert abs(aliran - (md["modal_akhir"] - md["modal_awal"])) < TOL, (
        "prive kemungkinan terhitung dua kali (laba_bersih sudah net prive)"
    )


def test_lr_sama_dengan_modal_pada_periode_pasca_pembuka(db):
    anchor, akhir = _periode(db)
    lr, md = _reports(db, anchor, akhir)
    assert abs(lr["laba_operasional"] - (md["info"].get("laba_operasional") or 0)) < TOL
    assert md.get("modal_awal_flow_dari") == anchor.isoformat()


def test_flow_dari_menandai_periode_pra_pembuka(db):
    """Periode sebelum posisi pembuka → mutasi kumulatif, UI wajib diberi tahu."""
    if ModalService(db)._saldo_awal_date() is None:
        pytest.skip("belum ada saldo awal impor")
    anchor, akhir = _periode(db)
    dari = anchor - timedelta(days=30)
    lr, md = _reports(db, dari, akhir)
    assert md["modal_awal_flow_dari"] == anchor.isoformat()
    assert md["modal_awal_flow_dari"] > dari.isoformat()
    # Laba operasional periode filter sama dengan Laba Rugi; perbedaan pra-pembuka berada di laba_ditahan_sebelumnya / pra-saldo-awal.
    assert abs(lr["laba_operasional"] - (md["info"].get("laba_operasional") or 0)) < TOL


def test_tidak_ada_field_unit_yang_dijumlah_ganda(db):
    """Ringkasan backend harus foot tanpa menjumlah ulang field per unit.

    Konsumen (finance/laporan.tsx) dulu menurunkan sendiri:
      labaKotor = b.laba_kotor + (m.revenue - m.hpp - m.beban_ops - m.maintenance) + ja.revenue
      totalBeban = pusat + b.* + ja.* + m.*
    Keduanya ganda-hitung `ja.maintenance` (sudah ada di ja_laba_kotor) dan
    komponen b_ops/gaji/lembur (sudah ada di laba bersih unit). Test ini menjaga
    agar ringkasan tetap konsisten sehingga tak ada alasan menurunkan ulang.
    """
    anchor, akhir = _periode(db)
    lr, _ = _reports(db, anchor, akhir)
    u = LabaRugiService(db).get_report(anchor, akhir)["units"]

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
