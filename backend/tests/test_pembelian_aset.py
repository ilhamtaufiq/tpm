"""Pembelian aset tetap (seperti pembelian spare part) tidak boleh menggeser modal.

Dulu form aset hanya mendaftar aset tanpa kas keluar → aset naik tanpa sumber
dana dan modal ikut naik lewat baris "Penyesuaian Backdate". Kini:
  KAS           → Kas Keluar sumber ASET (split), sisa jadi hutang ke penjual
  HUTANG        → seluruhnya hutang
  SETORAN_MODAL → setoran modal non-kas (Perubahan Modal)
Hapus aset membalik kas ([VOID]) dan menghapus hutang yang belum dibayar.
"""
from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.database.connection import SessionLocal
from app.models.keuangan import Aset, HutangUsaha, KasBank
from app.schemas.keuangan import AssetCreate, AssetPaymentItem
from app.services.asset_service import AssetService
from app.services.reports.modal_service import ModalService
from app.utils.constants import KasBankJenis, KasBankSource, PaymentMethod

TOL = 1.0


def _laba_dan_backdate(db):
    ms = ModalService(db)
    anchor = ms._saldo_awal_date() or date.today()
    akhir = max(date.today(), anchor)
    r = ms.get_report(anchor, akhir)
    return (
        r["penambahan"]["penyesuaian_backdate_non_impor"],
        r["penambahan"]["modal_non_kas"]["total"],
        r["modal_akhir"],
    )


def test_pembelian_aset_kas_hutang_setoran_dan_hapus():
    db = SessionLocal()
    svc = AssetService(db)
    dibuat = []
    try:
        if KasBank.get_current_balance(db, KasBankJenis.BANK_UTAMA) < Decimal("2000000"):
            pytest.skip("saldo BANK_UTAMA belum cukup (DB tanpa saldo awal)")
        back0, nonkas0, modal0 = _laba_dan_backdate(db)
        hari = date.today()

        kas = svc.create(AssetCreate(
            tanggal_beli=hari, nama="UJI Mesin Las", harga_beli=Decimal("5000000"),
            sumber_dana="KAS", nama_penjual="Toko Uji",
            payments=[AssetPaymentItem(metode=PaymentMethod.TRANSFER, jumlah=Decimal("2000000"),
                                       kas_jenis=KasBankJenis.BANK_UTAMA)],
        ), user_id=None)
        dibuat.append(kas.id)
        setoran = svc.create(AssetCreate(
            tanggal_beli=hari, nama="UJI Motor Setoran", harga_beli=Decimal("4000000"),
            sumber_dana="SETORAN_MODAL",
        ), user_id=None)
        dibuat.append(setoran.id)

        kb = db.query(KasBank).filter(KasBank.sumber == KasBankSource.ASET,
                                      KasBank.nomor_referensi == kas.kode).all()
        assert [float(k.nominal) for k in kb] == [2000000.0]
        h = db.query(HutangUsaha).filter(HutangUsaha.nomor_referensi == kas.kode).one()
        assert h.sisa_hutang == Decimal("3000000") and h.nama_kreditur == "Toko Uji"

        back1, nonkas1, modal1 = _laba_dan_backdate(db)
        assert abs(back1 - back0) < TOL, "pembelian aset menggeser penyesuaian backdate"
        assert abs((nonkas1 - nonkas0) - 4000000) < TOL, "setoran aset tidak tampil sebagai non-kas"
        assert abs((modal1 - modal0) - 4000000) < TOL, "hanya setoran pemilik yang menambah modal"

        with pytest.raises(HTTPException):
            svc.create(AssetCreate(tanggal_beli=hari, nama="UJI Tanpa Penjual",
                                   harga_beli=Decimal("1000000"), sumber_dana="HUTANG"), user_id=None)

        assert svc.delete(kas.id) and svc.delete(setoran.id)
        dibuat.clear()
        assert db.query(HutangUsaha).filter(HutangUsaha.nomor_referensi == kas.kode).count() == 0
        back2, nonkas2, modal2 = _laba_dan_backdate(db)
        assert abs(back2 - back0) < TOL and abs(modal2 - modal0) < TOL
    finally:
        for aset_id in dibuat:
            try:
                svc.delete(aset_id)
            except Exception:
                db.rollback()
        # Bersihkan jejak kas uji (pembelian + VOID) agar DB kembali seperti semula.
        db.query(KasBank).filter(KasBank.keterangan.like("%UJI %")).delete(synchronize_session=False)
        db.query(Aset).filter(Aset.nama.like("UJI %")).delete(synchronize_session=False)
        db.commit()
        db.close()
