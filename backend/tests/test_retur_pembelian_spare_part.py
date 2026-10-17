"""
Retur pembelian spare part: stok, hutang, kas, dan status pembelian harus
konsisten, termasuk saat retur dibatalkan.
"""
import uuid
from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy import or_

from app.database import SessionLocal
from app.models.bengkel import (
    DetailPembelianSparePart,
    DetailReturPembelianSparePart,
    PembelianSparePart,
    ReturPembelianSparePart,
    SparePart,
    SparePartRevaluation,
)
from app.models.keuangan import HutangUsaha, KasBank
from app.models.supplier import Supplier
from app.schemas.bengkel import DetailPembelianCreate, PaymentItem, PembelianSparePartCreate, ReturPembelianCreate, ReturPembelianItem
from app.services.pembelian_part_service import PembelianPartService
from app.services.retur_pembelian_service import ReturPembelianService
from app.utils.constants import HutangStatus, KasBankSource, PaymentMethod, PaymentStatus


def _supplier(db):
    s = Supplier(kode=f"TSR{uuid.uuid4().hex[:8]}".upper(), nama=f"Test Supplier {uuid.uuid4().hex[:6]}")
    db.add(s)
    db.commit()
    return s


def _part(db, harga):
    sp = SparePart(
        kode=f"TST-RTR-{uuid.uuid4().hex[:8]}",
        nama=f"Part Retur {uuid.uuid4().hex[:4]}",
        satuan="pcs",
        stok=Decimal("0"),
        stok_minimum=1,
        harga_beli=Decimal("0"),
        harga_jual=Decimal("0"),
    )
    db.add(sp)
    db.flush()
    return sp


def _beli(db, supplier, part, qty, harga, metode=None, bayar=None):
    payload = PembelianSparePartCreate(
        tanggal=date(2026, 10, 1),
        supplier_id=supplier.id,
        detail=[DetailPembelianCreate(spare_part_id=part.id, qty=Decimal(qty), harga_satuan=Decimal(harga))],
        metode_bayar=metode,
        payments=[PaymentItem(metode=PaymentMethod.TUNAI, jumlah=Decimal(bayar))] if bayar else [],
    )
    return PembelianPartService(db).create(payload, user_id=None)


def _retur(pembelian, items, metode=None, tanggal=date(2026, 10, 2)):
    return ReturPembelianCreate(
        tanggal=tanggal,
        detail=[ReturPembelianItem(detail_pembelian_id=d.id, qty=Decimal(q)) for d, q in items],
        metode_refund=metode,
    )


def _hutang(db, pembelian):
    return db.query(HutangUsaha).filter(HutangUsaha.nomor_referensi == pembelian.nomor_transaksi).first()


def _bersihkan(db, parts, pembelians, suppliers=()):
    for pb in pembelians:
        retur_list = db.query(ReturPembelianSparePart).filter(ReturPembelianSparePart.pembelian_id == pb.id).all()
        retur_ids = [r.id for r in retur_list]
        nomor_retur = [r.nomor_retur for r in retur_list]
        if retur_ids:
            db.query(DetailReturPembelianSparePart).filter(DetailReturPembelianSparePart.retur_id.in_(retur_ids)).delete(synchronize_session=False)
            db.query(ReturPembelianSparePart).filter(ReturPembelianSparePart.id.in_(retur_ids)).delete(synchronize_session=False)
        db.query(KasBank).filter(or_(KasBank.nomor_referensi == pb.nomor_transaksi, KasBank.nomor_referensi.in_(nomor_retur or [""]))).delete(synchronize_session=False)
        db.query(HutangUsaha).filter(HutangUsaha.nomor_referensi == pb.nomor_transaksi).delete(synchronize_session=False)
        db.query(SparePartRevaluation).filter(SparePartRevaluation.pembelian_id == pb.id).delete(synchronize_session=False)
        db.query(DetailPembelianSparePart).filter(DetailPembelianSparePart.pembelian_id == pb.id).delete(synchronize_session=False)
        db.query(PembelianSparePart).filter(PembelianSparePart.id == pb.id).delete(synchronize_session=False)
    for p in parts:
        db.query(SparePart).filter(SparePart.id == p.id).delete(synchronize_session=False)
    for s in suppliers:
        db.query(Supplier).filter(Supplier.id == s.id).delete(synchronize_session=False)
    db.commit()


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.rollback()
    session.close()


def test_retur_tunai_lunas_lalu_dibatalkan(db):
    supplier = _supplier(db)
    part = _part(db, 0)
    pb = _beli(db, supplier, part, 3, "100000", metode=PaymentMethod.TUNAI)
    part_id = part.id
    try:
        svc = ReturPembelianService(db)
        detail = pb.detail[0]
        retur = svc.create(pb.id, _retur(pb, [(detail, 2)], metode=PaymentMethod.TUNAI), user_id=None)

        assert retur.nilai_hutang == 0
        assert retur.nilai_kas == Decimal("200000")
        db.expire_all()
        assert db.get(SparePart, part_id).stok == Decimal("1")
        kas = db.query(KasBank).filter(KasBank.nomor_referensi == retur.nomor_retur, KasBank.tipe == "MASUK").all()
        assert len(kas) == 1 and kas[0].nominal == Decimal("200000")
        assert kas[0].sumber == KasBankSource.PEMBELIAN_PART
        assert db.get(PembelianSparePart, pb.id).status_bayar == PaymentStatus.LUNAS

        svc.void(retur.id, user_id=None)
        db.expire_all()
        assert db.get(SparePart, part_id).stok == Decimal("3")
        assert db.get(ReturPembelianSparePart, retur.id).dibatalkan is True
        void_kas = db.query(KasBank).filter(KasBank.nomor_referensi == retur.nomor_retur, KasBank.keterangan.like("[VOID]%")).all()
        assert len(void_kas) == 1 and void_kas[0].tipe == "KELUAR" and void_kas[0].nominal == Decimal("200000")
    finally:
        _bersihkan(db, [part], [pb], [supplier])


def test_retur_kredit_mengurangi_hutang_sampai_lunas_lalu_dibatalkan(db):
    supplier = _supplier(db)
    part = _part(db, 0)
    pb = _beli(db, supplier, part, 5, "200000", metode=PaymentMethod.KREDIT)
    try:
        hutang = _hutang(db, pb)
        assert hutang.sisa_hutang == Decimal("1000000")
        svc = ReturPembelianService(db)
        detail = pb.detail[0]

        r1 = svc.create(pb.id, _retur(pb, [(detail, 2)]), user_id=None)
        assert r1.nilai_hutang == Decimal("400000") and r1.nilai_kas == 0
        db.expire_all()
        h = _hutang(db, pb)
        assert h.sisa_hutang == Decimal("600000") and h.nominal_hutang == Decimal("600000")
        assert h.status == HutangStatus.BELUM_LUNAS
        assert db.get(PembelianSparePart, pb.id).status_bayar == PaymentStatus.BELUM_LUNAS

        r2 = svc.create(pb.id, _retur(pb, [(detail, 3)]), user_id=None)
        assert r2.nilai_hutang == Decimal("600000") and r2.nilai_kas == 0
        db.expire_all()
        h = _hutang(db, pb)
        assert h.sisa_hutang == 0 and h.status == HutangStatus.LUNAS
        pbr = db.get(PembelianSparePart, pb.id)
        assert pbr.status_bayar == PaymentStatus.LUNAS
        assert db.get(SparePart, part.id).stok == 0

        # Pembelian yang sudah lunas karena retur tidak boleh dicatat bayar lagi.
        with pytest.raises(HTTPException):
            PembelianPartService(db).update_payment(pb.id, PaymentMethod.TRANSFER)

        svc.void(r2.id, user_id=None)
        db.expire_all()
        h = _hutang(db, pb)
        assert h.sisa_hutang == Decimal("600000") and h.status == HutangStatus.BELUM_LUNAS
        assert db.get(PembelianSparePart, pb.id).status_bayar == PaymentStatus.BELUM_LUNAS
        assert db.get(SparePart, part.id).stok == Decimal("3")
    finally:
        _bersihkan(db, [part], [pb], [supplier])


def test_retur_campuran_hutang_dan_kas(db):
    supplier = _supplier(db)
    part = _part(db, 0)
    pb = _beli(db, supplier, part, 5, "200000", metode=PaymentMethod.SPLIT, bayar="500000")
    try:
        assert _hutang(db, pb).sisa_hutang == Decimal("500000")
        svc = ReturPembelianService(db)
        detail = pb.detail[0]
        r = svc.create(pb.id, _retur(pb, [(detail, 4)], metode=PaymentMethod.TRANSFER), user_id=None)
        assert r.total_retur == Decimal("800000")
        assert r.nilai_hutang == Decimal("500000")
        assert r.nilai_kas == Decimal("300000")
        db.expire_all()
        kas = db.query(KasBank).filter(KasBank.nomor_referensi == r.nomor_retur).all()
        assert len(kas) == 1 and kas[0].tipe == "MASUK" and kas[0].nominal == Decimal("300000")
        assert _hutang(db, pb).status == HutangStatus.LUNAS
    finally:
        _bersihkan(db, [part], [pb], [supplier])


def test_retur_ditolak_bila_tidak_valid(db):
    supplier = _supplier(db)
    part = _part(db, 0)
    pb = _beli(db, supplier, part, 2, "100000", metode=PaymentMethod.TUNAI)
    pb2 = None
    try:
        svc = ReturPembelianService(db)
        detail = pb.detail[0]

        # Qty melebihi sisa yang bisa diretur.
        with pytest.raises(HTTPException) as e:
            svc.create(pb.id, _retur(pb, [(detail, 3)], metode=PaymentMethod.TUNAI), user_id=None)
        assert e.value.status_code == 400

        # Dana kembali ke kas tapi metode refund tidak diisi.
        with pytest.raises(HTTPException) as e:
            svc.create(pb.id, _retur(pb, [(detail, 1)]), user_id=None)
        assert e.value.status_code == 400

        # Stok sudah berkurang (terjual) → tidak cukup untuk diretur.
        db.query(SparePart).filter(SparePart.id == part.id).update({"stok": Decimal("0")})
        db.commit()
        with pytest.raises(HTTPException) as e:
            svc.create(pb.id, _retur(pb, [(detail, 1)], metode=PaymentMethod.TUNAI), user_id=None)
        assert "Stok" in e.value.detail
        db.query(SparePart).filter(SparePart.id == part.id).update({"stok": Decimal("2")})
        db.commit()

        # Harga beli berubah setelah pembelian ini → retur ditolak.
        pb2 = _beli(db, supplier, part, 1, "150000", metode=PaymentMethod.TUNAI)
        with pytest.raises(HTTPException) as e:
            svc.create(pb.id, _retur(pb, [(detail, 1)], metode=PaymentMethod.TUNAI), user_id=None)
        assert "harga" in e.value.detail.lower()

        # Pembelian yang sudah punya retur tidak boleh diubah atau dihapus.
        retur = svc.create(pb2.id, _retur(pb2, [(pb2.detail[0], 1)], metode=PaymentMethod.TUNAI), user_id=None)
        with pytest.raises(HTTPException):
            PembelianPartService(db).delete(pb2.id)
        svc.void(retur.id, user_id=None)
        db.expire_all()
    finally:
        _bersihkan(db, [part], [p for p in (pb, pb2) if p is not None], [supplier])


def test_preview_sama_dengan_simpan_dan_tidak_menulis(db):
    supplier = _supplier(db)
    part = _part(db, 0)
    pb = _beli(db, supplier, part, 2, "100000", metode=PaymentMethod.SPLIT, bayar="50000")
    try:
        svc = ReturPembelianService(db)
        detail = pb.detail[0]
        req = _retur(pb, [(detail, 2)], metode=PaymentMethod.TUNAI)
        pv = svc.preview(pb.id, req)
        assert pv["nilai_hutang"] == Decimal("150000")
        assert pv["nilai_kas"] == Decimal("50000")
        db.expire_all()
        assert db.get(SparePart, part.id).stok == Decimal("2")
        assert _hutang(db, pb).sisa_hutang == Decimal("150000")
        assert db.query(ReturPembelianSparePart).filter(ReturPembelianSparePart.pembelian_id == pb.id).count() == 0

        r = svc.create(pb.id, req, user_id=None)
        assert r.nilai_hutang == pv["nilai_hutang"] and r.nilai_kas == pv["nilai_kas"]
    finally:
        _bersihkan(db, [part], [pb], [supplier])
