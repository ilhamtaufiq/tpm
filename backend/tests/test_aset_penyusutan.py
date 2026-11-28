"""Aset tetap: penyusutan garis lurus, sumber armada, dan dampaknya ke Laba Rugi serta Neraca."""
from datetime import date
from decimal import Decimal

import pytest

from app.database import SessionLocal
from app.models.jasa_angkut import ArmadaJasaAngkut
from app.models.keuangan import Aset
from app.schemas.keuangan import AssetCreate
from app.services.asset_service import AssetService
from app.services.reports.laba_rugi_service import LabaRugiService
from app.services.reports.neraca_service import NeracaService
from app.utils.constants import AssetCategory, AssetStatus


def _aset(db, **kw):
    a = Aset(
        kode=kw.pop("kode"), nama=kw.pop("nama", "Uji penyusutan"), kategori=AssetCategory.PERALATAN,
        tanggal_beli=kw.pop("tanggal_beli"), harga_beli=kw.pop("harga_beli"),
        nilai_residu=kw.pop("nilai_residu", Decimal("0")), umur_ekonomis=kw.pop("umur_ekonomis", 1),
        status=AssetStatus.AKTIF, sumber_dana=None, **kw,
    )
    db.add(a)
    db.commit()
    return a


def test_penyusutan_garis_lurus_per_bulan():
    db = SessionLocal()
    aset = None
    try:
        aset = _aset(db, kode="UJI-PNY-1", tanggal_beli=date(2026, 1, 15), harga_beli=Decimal("12000000"),
                     nilai_residu=Decimal("0"), umur_ekonomis=1)
        assert aset.penyusutan_per_bulan == Decimal("1000000.00")
        assert aset.akumulasi_pada(date(2026, 1, 31)) == Decimal("1000000.00")
        assert aset.akumulasi_pada(date(2026, 11, 30)) == Decimal("11000000.00")
        # Umur habis (12 bulan): akumulasi dibatasi sampai harga - residu
        assert aset.akumulasi_pada(date(2027, 6, 30)) == Decimal("12000000.00")
        assert aset.nilai_buku.__class__ is Decimal
        assert aset.akumulasi_pada(date(2025, 12, 31)) == Decimal("0")
    finally:
        if aset is not None:
            db.delete(aset)
            db.commit()
        db.close()


def test_beban_penyusutan_masuk_laba_rugi_periode_november():
    db = SessionLocal()
    aset = None
    try:
        aset = _aset(db, kode="UJI-PNY-2", tanggal_beli=date(2026, 1, 1), harga_beli=Decimal("12000000"),
                     umur_ekonomis=1)
        rep = LabaRugiService(db).get_report(date(2026, 11, 1), date(2026, 11, 30))
        beban = rep["summary"]["beban_penyusutan"]
        # Aset ini saja sudah menyumbang 1 juta per bulan; aset lain yang aktif ikut dihitung
        assert beban >= 1_000_000
        neraca = NeracaService(db).get_report(date(2026, 11, 30))
        assert neraca["is_balanced"] is True
    finally:
        if aset is not None:
            db.delete(aset)
            db.commit()
        db.close()


def test_armada_jadi_aset_setoran_modal_dengan_harga_manual():
    db = SessionLocal()
    armada = None
    aset_id = None
    try:
        armada = ArmadaJasaAngkut(nama="Uji Armada Aset", nopol="UJI-AS-1", jenis="Uji")
        db.add(armada)
        db.commit()
        svc = AssetService(db)
        obj = AssetCreate(
            tanggal_beli=date(2026, 11, 1), nama="Uji Armada Aset", kategori=AssetCategory.KENDARAAN,
            harga_beli=Decimal("150000000"), umur_ekonomis=5, nilai_residu=Decimal("0"),
            sumber_aset="ARMADA", referensi_id=armada.id,
        )
        hasil = svc.create(obj, user_id=None)
        aset_id = hasil.id
        assert hasil.sumber_aset == "ARMADA"
        assert hasil.referensi_id == armada.id
        assert hasil.sumber_dana == "SETORAN_MODAL"
        assert hasil.harga_beli == Decimal("150000000")
    finally:
        if aset_id:
            db.query(Aset).filter(Aset.id == aset_id).delete(synchronize_session=False)
        if armada is not None:
            db.delete(armada)
        db.commit()
        db.close()


def test_armada_tanpa_harga_ditolak():
    db = SessionLocal()
    armada = None
    try:
        armada = ArmadaJasaAngkut(nama="Uji Armada Tanpa Harga", nopol="UJI-AS-2", jenis="Uji")
        db.add(armada)
        db.commit()
        with pytest.raises(Exception):
            AssetCreate(
                tanggal_beli=date(2026, 11, 1), nama="Uji", harga_beli=Decimal("0"), sumber_aset="ARMADA",
                referensi_id=armada.id,
            )
    finally:
        if armada is not None:
            db.delete(armada)
            db.commit()
        db.close()
