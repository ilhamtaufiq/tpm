"""Kode pendek link struk: idempoten per (tipe, target), bisa di-resolve, dan menolak input tidak valid."""
import pytest

from app.database import SessionLocal
from app.models.short_link import ShortLink
from app.services.short_link_service import ShortLinkService

PREFIX = "TEST-SHORT-"


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.rollback()
    session.query(ShortLink).filter(ShortLink.target.like(f"{PREFIX}%")).delete(synchronize_session=False)
    session.commit()
    session.close()


def test_buat_short_link_idempoten_dan_bisa_di_resolve(db):
    target = f"{PREFIX}hvi_abc123"
    pertama = ShortLinkService(db).buat_atau_ambil("bengkel", target)
    kedua = ShortLinkService(db).buat_atau_ambil("bengkel", target)
    assert pertama.kode == kedua.kode
    assert len(pertama.kode) == 7
    resolved = ShortLinkService(db).ambil(pertama.kode)
    assert resolved is not None
    assert (resolved.tipe, resolved.target) == ("bengkel", target)


def test_kode_tidak_dikenal_mengembalikan_none(db):
    assert ShortLinkService(db).ambil("zzzzzzz") is None


def test_tipe_dan_target_tidak_valid_ditolak(db):
    with pytest.raises(ValueError):
        ShortLinkService(db).buat_atau_ambil("piutang", f"{PREFIX}x")
    with pytest.raises(ValueError):
        ShortLinkService(db).buat_atau_ambil("bengkel", f"{PREFIX}tidak/valid")


def test_redirect_kode_pendek_ke_halaman_struk(db):
    from fastapi.testclient import TestClient

    from app.main import app

    target = f"{PREFIX}hvi_redirect1"
    kode = ShortLinkService(db).buat_atau_ambil("bengkel", target).kode
    client = TestClient(app)
    respon = client.get(f"/s/{kode}")
    assert respon.status_code == 200
    assert 'property="og:image"' in respon.text
    assert 'property="og:title"' in respon.text
    assert f"/public/receipt/view/bengkel/{target}" in respon.text
    assert client.get("/s/zzzzzzz", follow_redirects=False).status_code == 404
