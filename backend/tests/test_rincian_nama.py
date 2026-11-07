"""Rincian piutang/hutang per nama: token stabil, data semua struk, halaman publik, dan link pendek."""
from datetime import timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models.keuangan import HutangUsaha, PiutangUsaha
from app.models.system_setting import SystemSetting
from app.services.rincian_nama_service import JENIS_HUTANG, JENIS_PIUTANG, buat_atau_ambil_token, data_rincian
from app.services.short_link_service import ShortLinkService
from app.utils.constants import HutangSource, HutangStatus, KasBankSource, PiutangSource, PiutangStatus
from app.utils.helpers import get_jakarta_date

NAMA = "UJI RINCIAN ALAM"
PREFIX = "PTG-TEST-RINCIAN"
PREFIX_H = "HTG-TEST-RINCIAN"


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.rollback()
    session.query(PiutangUsaha).filter(PiutangUsaha.nomor_piutang.like(f"{PREFIX}%")).delete(synchronize_session=False)
    session.query(HutangUsaha).filter(HutangUsaha.nomor_hutang.like(f"{PREFIX_H}%")).delete(synchronize_session=False)
    session.query(SystemSetting).filter(
        SystemSetting.key.like("rincian_nama:%"), SystemSetting.value.like("%UJI RINCIAN%")
    ).delete(synchronize_session=False)
    session.commit()
    session.close()


def _piutang(db, nomor, status, nominal="100000", dibayar="0"):
    nominal_d, dibayar_d = Decimal(nominal), Decimal(dibayar)
    p = PiutangUsaha(
        nomor_piutang=f"{PREFIX}-{nomor}", tanggal=get_jakarta_date() - timedelta(days=1), sumber=PiutangSource.LAINNYA,
        nama_debitur=NAMA, nominal_piutang=nominal_d, total_dibayar=dibayar_d, sisa_piutang=nominal_d - dibayar_d,
        status=status, is_internal=False,
    )
    db.add(p)
    db.commit()
    return p


def test_token_stabil_dan_terpisah_per_jenis_dan_unit(db):
    pertama = buat_atau_ambil_token(db, JENIS_PIUTANG, NAMA, None)
    kedua = buat_atau_ambil_token(db, JENIS_PIUTANG, f"  {NAMA.lower()} ", None)
    assert pertama == kedua
    assert len(pertama) == 40
    assert buat_atau_ambil_token(db, JENIS_PIUTANG, NAMA, KasBankSource.BENGKEL) != pertama
    assert buat_atau_ambil_token(db, JENIS_HUTANG, NAMA, None) != pertama


def test_data_rincian_memuat_semua_struk_dan_mengecualikan_batal(db):
    _piutang(db, "1", PiutangStatus.BELUM_LUNAS)
    _piutang(db, "2", PiutangStatus.LUNAS, nominal="50000", dibayar="50000")
    _piutang(db, "3", PiutangStatus.BATAL)
    token = buat_atau_ambil_token(db, JENIS_PIUTANG, NAMA, None)

    data = data_rincian(db, token)
    nomor = {s["nomor"] for s in data["struk"]}
    assert nomor == {f"{PREFIX}-1", f"{PREFIX}-2"}
    labels = {s["nomor"]: s["status_label"] for s in data["struk"]}
    assert labels[f"{PREFIX}-1"] == "BELUM BAYAR"
    assert labels[f"{PREFIX}-2"] == "LUNAS"
    assert data["total_sisa"] == pytest.approx(100000)
    assert data["total_nominal"] == pytest.approx(150000)


def test_halaman_publik_rincian_dan_token_salah(db):
    _piutang(db, "1", PiutangStatus.BELUM_LUNAS)
    token = buat_atau_ambil_token(db, JENIS_PIUTANG, NAMA, None)
    client = TestClient(app)

    view = client.get(f"/api/v1/public/receipt/view/rincian_piutang/{token}")
    assert view.status_code == 200
    assert "Rincian Piutang: UJI RINCIAN ALAM" in view.text
    assert f"{PREFIX}-1" in view.text
    assert "BELUM BAYAR" in view.text

    assert client.get(f"/api/v1/public/receipt/view/rincian_piutang/{'0' * 40}").status_code == 404
    assert client.get("/api/v1/public/receipt/view/rincian_piutang/tidak-valid").status_code == 404


def test_link_pendek_rincian_tanpa_gambar_struk(db):
    _piutang(db, "1", PiutangStatus.BELUM_LUNAS)
    token = buat_atau_ambil_token(db, JENIS_PIUTANG, NAMA, None)
    link = ShortLinkService(db).buat_atau_ambil("rincian_piutang", token)
    assert link.kode and link.tipe == "rincian_piutang"

    halaman = TestClient(app).get(f"/s/{link.kode}")
    assert halaman.status_code == 200
    assert f"/view/rincian_piutang/{token}" in halaman.text
    assert "receipt/image" not in halaman.text


def test_endpoint_pembuat_token_butuh_login():
    client = TestClient(app)
    res = client.post("/api/v1/per-nama/piutang/rincian-token", json={"nama": NAMA})
    assert res.status_code in (401, 403)
