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


def test_unit_mobil_tanpa_id_ditolak_404():
    from fastapi import HTTPException
    db = SessionLocal()
    try:
        svc = AssetService(db)
        with pytest.raises(HTTPException) as exc:
            svc.create(AssetCreate(tanggal_beli=date(2026, 11, 1), nama="Uji Mobil Tidak Ada", harga_beli=Decimal("1"),
                                   sumber_aset="MOBIL", referensi_id=999999999), user_id=None)
        assert exc.value.status_code == 404
    finally:
        db.close()


def test_unit_mobil_dipindah_keluar_stok_tanpa_penjualan():
    """Unit TPM yang belum terjual dipindah ke aset: keluar dari stok (tanpa penjualan), nilai aset = nilai stok."""
    from app.models.mobil import Mobil, stok_pada
    from app.services.asset_service import nilai_stok_unit_mobil
    from app.utils.constants import OwnershipType
    db = SessionLocal()
    aset_id = None
    mobil = None
    try:
        mobil = (
            db.query(Mobil)
            .filter(Mobil.tanggal_terjual.is_(None), Mobil.tanggal_aset.is_(None), Mobil.deleted_at.is_(None),
                    Mobil.tipe_kepemilikan != OwnershipType.INVESTOR)
            .order_by(Mobil.id)
            .first()
        )
        if mobil is None:
            pytest.skip("tidak ada unit TPM belum terjual di DB uji")
        hari = date.today()
        nilai = nilai_stok_unit_mobil(db, mobil, hari)
        ada_sebelum = db.query(Mobil.id).filter(Mobil.id == mobil.id, stok_pada(hari)).first() is not None
        assert ada_sebelum

        aset = AssetService(db).create(AssetCreate(
            tanggal_beli=hari, nama="Uji unit dipindah", kategori=AssetCategory.KENDARAAN,
            harga_beli=Decimal("1"), umur_ekonomis=5, nilai_residu=Decimal("0"),
            sumber_aset="MOBIL", referensi_id=mobil.id,
        ), user_id=None)
        aset_id = aset.id
        db.refresh(mobil)
        assert aset.sumber_aset == "MOBIL" and aset.sumber_dana is None
        assert aset.harga_beli == nilai
        assert mobil.tanggal_aset == hari and mobil.tanggal_terjual is None
        assert db.query(Mobil.id).filter(Mobil.id == mobil.id, stok_pada(hari)).first() is None

        # Unit yang sudah dipindah tidak boleh dipindah lagi
        with pytest.raises(Exception):
            AssetService(db).create(AssetCreate(
                tanggal_beli=hari, nama="Uji unit ganda", harga_beli=Decimal("1"),
                sumber_aset="MOBIL", referensi_id=mobil.id,
            ), user_id=None)
    finally:
        if aset_id:
            db.query(Aset).filter(Aset.id == aset_id).delete(synchronize_session=False)
        if mobil is not None:
            db.refresh(mobil)
            mobil.tanggal_aset = None
        db.commit()
        db.close()


def test_jual_aset_laba_rugi_dan_neraca_seimbang():
    """Aset dijual: kas masuk, status DIJUAL, penyusutan berhenti, laba/rugi pelepasan = harga jual - nilai buku."""
    from datetime import timedelta
    from app.utils.helpers import get_jakarta_date
    from app.services.reports.neraca_service import NeracaService
    from app.services.reports.laba_rugi_service import LabaRugiService
    from app.models.keuangan import KasBank
    from app.utils.constants import KasBankSource, PaymentMethod, KasBankJenis
    db = SessionLocal()
    aset_id = None
    try:
        hari = get_jakarta_date()
        beli = hari - timedelta(days=60)
        svc = AssetService(db)
        a = svc.create(AssetCreate(tanggal_beli=beli, nama="Uji jual aset", kategori=AssetCategory.PERALATAN,
                                   harga_beli=Decimal("12000000"), umur_ekonomis=1, nilai_residu=Decimal("0"),
                                   sumber_dana="SETORAN_MODAL"), user_id=None)
        aset_id = a.id
        jual_tgl = hari - timedelta(days=30)
        nb = Decimal("12000000") - a.akumulasi_pada(jual_tgl)
        hasil = svc.jual(aset_id, jual_tgl, Decimal("5000000"), PaymentMethod.TUNAI, KasBankJenis.KAS_UTAMA, None)
        db.refresh(a)
        assert a.status.value == "DIJUAL" and a.tanggal_jual == jual_tgl
        assert hasil["laba_rugi_pelepasan"] == Decimal("5000000") - nb
        assert a.akumulasi_pada(hari) == a.akumulasi_pada(jual_tgl)  # penyusutan berhenti
        kas = db.query(KasBank).filter(KasBank.referensi_id == aset_id, KasBank.sumber == KasBankSource.ASET).all()
        assert [float(k.nominal) for k in kas] == [5000000.0]
        neraca = NeracaService(db).get_report(hari)
        assert neraca["is_balanced"] is True
        assert all(d["kode"] != a.kode for d in neraca["aktiva_tetap"]["detail_aset"])
        lr = LabaRugiService(db).get_report(jual_tgl.replace(day=1), hari)
        assert abs(lr["summary"]["laba_pelepasan_aset"] - float(hasil["laba_rugi_pelepasan"])) < 1
    finally:
        if aset_id:
            db.query(KasBank).filter(KasBank.referensi_id == aset_id, KasBank.sumber == KasBankSource.ASET).delete(synchronize_session=False)
            db.query(Aset).filter(Aset.id == aset_id).delete(synchronize_session=False)
        db.commit()
        db.close()
