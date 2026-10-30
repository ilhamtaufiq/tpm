"""Struk digital piutang dan hutang: token publik, data, halaman view, dan link pendek."""
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models.keuangan import HutangUsaha, PembayaranHutang, PembayaranPiutang, PiutangUsaha
from app.models.short_link import ShortLink
from app.services.struk_piutang_service import (
    buat_atau_ambil_token,
    get_hutang_receipt,
    get_piutang_receipt,
)
from app.utils.constants import HutangSource, HutangStatus, PaymentMethod, PiutangSource, PiutangStatus

PREFIX = "TEST-STRUK-"


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.rollback()
    piutang_ids = [p.id for p in session.query(PiutangUsaha).filter(PiutangUsaha.nomor_piutang.like(f"{PREFIX}%")).all()]
    session.query(PembayaranPiutang).filter(PembayaranPiutang.piutang_id.in_(piutang_ids)).delete(synchronize_session=False)
    session.query(PiutangUsaha).filter(PiutangUsaha.nomor_piutang.like(f"{PREFIX}%")).delete(synchronize_session=False)
    hutang_ids = [h.id for h in session.query(HutangUsaha).filter(HutangUsaha.nomor_hutang.like(f"{PREFIX}%")).all()]
    session.query(PembayaranHutang).filter(PembayaranHutang.hutang_id.in_(hutang_ids)).delete(synchronize_session=False)
    session.query(HutangUsaha).filter(HutangUsaha.nomor_hutang.like(f"{PREFIX}%")).delete(synchronize_session=False)
    session.query(ShortLink).filter(ShortLink.target.like(f"{PREFIX}%")).delete(synchronize_session=False)
    session.commit()
    session.close()


def _piutang(db, nomor=f"{PREFIX}P1"):
    p = PiutangUsaha(
        nomor_piutang=nomor, tanggal=date.today(), sumber=PiutangSource.BENGKEL,
        nama_debitur="Akas alam", nominal_piutang=Decimal("500000"), total_dibayar=Decimal("200000"),
        sisa_piutang=Decimal("300000"), status=PiutangStatus.SEBAGIAN, is_internal=False,
        nomor_referensi="BGL-UJI-1", catatan="Dicicil dua kali",
    )
    db.add(p)
    db.flush()
    db.add(PembayaranPiutang(piutang_id=p.id, tanggal=date.today(), nominal=Decimal("200000"),
                             metode_bayar=PaymentMethod.TUNAI, catatan="cicilan 1"))
    db.commit()
    return p


def _hutang(db, nomor=f"{PREFIX}H1"):
    h = HutangUsaha(
        nomor_hutang=nomor, tanggal=date.today(), sumber=HutangSource.LAINNYA,
        nama_kreditur="Toko Uji", nominal_hutang=Decimal("150000"), total_dibayar=Decimal("0"),
        sisa_hutang=Decimal("150000"), status=HutangStatus.BELUM_LUNAS, is_internal=False,
    )
    db.add(h)
    db.commit()
    return h


def test_token_dibuat_sekali_lalu_dipakai_ulang(db):
    p = _piutang(db)
    pertama = buat_atau_ambil_token(db, p)
    kedua = buat_atau_ambil_token(db, p)
    assert pertama and pertama == kedua
    assert len(pertama) >= 32


def test_data_piutang_memuat_riwayat_dan_sisa(db):
    p = _piutang(db)
    token = buat_atau_ambil_token(db, p)
    data = get_piutang_receipt(db, token)
    assert data["receiptKind"] == "PIUTANG"
    assert data["transactionNumber"] == p.nomor_piutang
    assert data["customerName"] == "Akas alam"
    assert data["total"] == 500000
    assert data["paid"] == 200000
    assert data["remaining"] == 300000
    assert data["paymentStatus"] == "BELUM LUNAS"
    assert len(data["payments"]) == 1 and data["payments"][0]["metode"] == "TUNAI"
    assert "BGL-UJI-1" in data["items"][0]["description"]


def test_data_hutang_belum_dibayar_tampil_belum_bayar(db):
    h = _hutang(db)
    token = buat_atau_ambil_token(db, h)
    data = get_hutang_receipt(db, token)
    assert data["receiptKind"] == "HUTANG"
    assert data["customerName"] == "Toko Uji"
    assert data["paymentStatus"] == "BELUM BAYAR"
    assert data["payments"] == []


def test_token_tidak_dikenal_404(db):
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        get_piutang_receipt(db, "tidak-ada-token")
    assert exc.value.status_code == 404


def test_endpoint_publik_piutang_view_dan_gambar(db):
    p = _piutang(db)
    token = buat_atau_ambil_token(db, p)
    client = TestClient(app)

    data = client.get(f"/api/v1/public/receipt/piutang/{token}")
    assert data.status_code == 200
    assert data.json()["receiptKind"] == "PIUTANG"

    view = client.get(f"/api/v1/public/receipt/view/piutang/{token}")
    assert view.status_code == 200
    assert "RIWAYAT PEMBAYARAN" in view.text
    assert "Akas alam" in view.text
    assert "BELUM LUNAS" in view.text

    img = client.get(f"/api/v1/public/receipt/image/piutang/{token}")
    assert img.status_code == 200
    assert img.headers["content-type"] == "image/png"


def test_endpoint_token_salah_404(db):
    client = TestClient(app)
    assert client.get("/api/v1/public/receipt/piutang/tidak-ada").status_code == 404
    assert client.get("/api/v1/public/receipt/view/hutang/tidak-ada").status_code == 404


def test_link_pendek_untuk_piutang_dan_hutang_bisa_dibuat(db):
    from app.services.short_link_service import ShortLinkService
    p = _piutang(db)
    token = buat_atau_ambil_token(db, p)
    link = ShortLinkService(db).buat_atau_ambil("piutang", token)
    assert link.kode and link.tipe == "piutang"
