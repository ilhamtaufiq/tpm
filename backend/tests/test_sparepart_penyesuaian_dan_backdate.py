"""Regresi penyesuaian harga/stok spare part & edit tanggal transaksi bengkel.

1. Nilai persediaan historis (tanggal lampau) tidak boleh ikut berubah oleh
   revaluasi / koreksi qty yang terjadi SESUDAH tanggal itu.
2. Edit harga beli di Master Data (stok > 0) dicatat sebagai revaluasi →
   persediaan tetap harga perolehan, modal tidak bergeser.
3. Edit tanggal transaksi bengkel ikut memindahkan kas pembayarannya.
"""
from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.database.connection import SessionLocal
from app.models.bengkel import (
    DetailTransaksiServices,
    SparePart,
    SparePartRevaluation,
    TransaksiPenjualanBengkel,
)
from app.models.keuangan import KasBank, PiutangUsaha
from app.schemas.bengkel import DetailServiceCreate, TransaksiBengkelCreate
from app.services.reports.base import BaseReportService
from app.services.spare_part_service import SparePartService
from app.services.transaksi_bengkel_service import TransaksiBengkelService
from app.utils.constants import PaymentMethod, WorkshopStatus
from app.utils.helpers import get_jakarta_date
from app.utils.sparepart_stock import ALWAYS_READY_STOCK

TOL = 0.01


def _persediaan(db, d):
    return float(BaseReportService(db).get_unit_financial_breakdown(d, d)["assets"]["persediaan_part"])


def _part_berstok(db):
    sp = (
        db.query(SparePart)
        .filter(SparePart.deleted_at.is_(None), SparePart.stok > 0,
                SparePart.stok != ALWAYS_READY_STOCK, SparePart.harga_beli > 0)
        .first()
    )
    if sp is None:
        pytest.skip("tidak ada spare part berstok di DB ini")
    return sp


def test_persediaan_lampau_tidak_terpengaruh_revaluasi_sesudahnya():
    """Edit harga & koreksi stok hari ini tidak boleh mengubah persediaan kemarin."""
    db = SessionLocal()
    sp = _part_berstok(db)
    sp_id, harga_awal, stok_awal = sp.id, Decimal(sp.harga_beli), Decimal(sp.stok)
    kemarin = get_jakarta_date() - timedelta(days=1)
    max_id = db.query(SparePartRevaluation.id).order_by(SparePartRevaluation.id.desc()).limit(1).scalar() or 0
    try:
        sebelum = _persediaan(db, kemarin)
        svc = SparePartService(db)
        svc.update_price(sp_id, harga_beli=harga_awal + Decimal("2500"))
        svc.update_stock(sp_id, 3, "add")
        db.expire_all()
        assert abs(_persediaan(db, kemarin) - sebelum) < TOL
    finally:
        db.query(SparePartRevaluation).filter(SparePartRevaluation.id > max_id).delete(synchronize_session=False)
        db.query(SparePart).filter(SparePart.id == sp_id).update({"harga_beli": harga_awal, "stok": stok_awal})
        db.commit()
        db.close()


def test_edit_harga_beli_master_dicatat_revaluasi():
    db = SessionLocal()
    sp = _part_berstok(db)
    sp_id, harga_awal, stok = sp.id, Decimal(sp.harga_beli), Decimal(sp.stok)
    hari = get_jakarta_date()
    max_id = db.query(SparePartRevaluation.id).order_by(SparePartRevaluation.id.desc()).limit(1).scalar() or 0
    try:
        sebelum = _persediaan(db, hari)
        SparePartService(db).update_price(sp_id, harga_beli=harga_awal + Decimal("1000"))
        rev = db.query(SparePartRevaluation).filter(SparePartRevaluation.id > max_id).all()
        assert len(rev) == 1 and not rev[0].is_qty_correction
        assert rev[0].amount == Decimal("1000") * stok
        assert abs(_persediaan(db, hari) - sebelum) < TOL, "edit harga master menggeser nilai persediaan"
    finally:
        db.query(SparePartRevaluation).filter(SparePartRevaluation.id > max_id).delete(synchronize_session=False)
        db.query(SparePart).filter(SparePart.id == sp_id).update({"harga_beli": harga_awal})
        db.commit()
        db.close()


def test_edit_tanggal_transaksi_bengkel_memindahkan_kas():
    db = SessionLocal()
    svc = TransaksiBengkelService(db)
    tx_id = None
    try:
        payload = dict(
            nama_customer="UJI Tanggal", kategori="umum",
            detail_services=[DetailServiceCreate(nama_jasa="Jasa uji tanggal", harga=Decimal("50000"))],
            metode_bayar=PaymentMethod.TUNAI, jumlah_bayar=Decimal("50000"),
            status_pengerjaan=WorkshopStatus.SELESAI,
        )
        tx = svc.create(TransaksiBengkelCreate(**payload), user_id=None)
        tx_id, nomor = tx.id, tx.nomor_transaksi
        mundur = tx.tanggal - timedelta(days=2)
        svc.update(tx_id, TransaksiBengkelCreate(**payload, tanggal=mundur), user_id=None)
        db.expire_all()
        kas = db.query(KasBank).filter(KasBank.nomor_referensi == nomor).all()
        assert kas, "kas pembayaran tidak terbentuk"
        assert all(k.tanggal == mundur for k in kas), [k.tanggal for k in kas]
    finally:
        if tx_id is not None:
            tx = db.get(TransaksiPenjualanBengkel, tx_id)
            db.query(KasBank).filter(KasBank.nomor_referensi == tx.nomor_transaksi).delete(synchronize_session=False)
            db.query(PiutangUsaha).filter(PiutangUsaha.nomor_referensi == tx.nomor_transaksi).delete(synchronize_session=False)
            db.query(DetailTransaksiServices).filter(DetailTransaksiServices.transaksi_id == tx_id).delete(synchronize_session=False)
            db.delete(tx)
            db.commit()
        db.close()
