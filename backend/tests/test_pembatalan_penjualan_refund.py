"""Pembatalan penjualan mobil LUNAS: refund langsung (kas dibalik) atau hutang.

- LANGSUNG: semua uang masuk pembeli dibalik lewat kas KELUAR pilihan user.
- HUTANG: kas tidak bergerak; sisa uang diterima jadi hutang uang muka penjualan.
Tes membuat mobil & penjualan sendiri (DB uji bisa kosong).
"""
from datetime import date
from decimal import Decimal

from app.database.connection import SessionLocal
from app.models.keuangan import HutangUsaha, KasBank, PembayaranPiutang, PiutangUsaha
from app.models.mobil import Mobil, TransaksiPenjualanMobil
from app.schemas.mobil import PaymentItem, TransaksiMobilCreate
from app.services.data_import_service import DataImportService
from app.services.penjualan_mobil_service import PenjualanMobilService
from app.utils.constants import (
    HutangSource,
    KasBankJenis,
    KasBankSource,
    KasBankType,
    PaymentMethod,
    PaymentStatus,
)

HARGA = Decimal("10000000")
PLAT = "T 7777 JUAL"


def _mobil_uji(db) -> Mobil:
    db.query(Mobil).filter(Mobil.nomor_plat == PLAT).delete(synchronize_session=False)
    db.commit()
    res = DataImportService(db)._apply_mobil(
        [{"_row": 2, "merek": "UJI", "model": "JUAL", "tahun": 2020, "warna": "HITAM",
          "nomor_plat": PLAT, "harga_beli": 8000000}],
        dry=False, user_id=None,
    )
    assert res["errors"] == [] and res["created"] == 1
    db.flush()
    return db.query(Mobil).filter(Mobil.nomor_plat == PLAT).one()


def _jual_lunas(db, mobil_id: int) -> TransaksiPenjualanMobil:
    trx = PenjualanMobilService(db).create(TransaksiMobilCreate(
        tanggal=date(2026, 9, 18), mobil_id=mobil_id, nama_pembeli="TEST JUAL BATAL",
        harga_jual=HARGA, dp=HARGA, metode_bayar="TRANSFER",
        payments=[PaymentItem(metode="TRANSFER", nominal=HARGA)],
    ), user_id=None)
    assert trx.status_bayar == PaymentStatus.LUNAS
    return trx


def _bersihkan(db, nomor: str, mobil_id: int):
    piutang_ids = [p.id for p in db.query(PiutangUsaha.id).filter(PiutangUsaha.nomor_referensi == nomor).all()]
    if piutang_ids:
        db.query(PembayaranPiutang).filter(PembayaranPiutang.piutang_id.in_(piutang_ids)).delete(synchronize_session=False)
        db.query(PiutangUsaha).filter(PiutangUsaha.id.in_(piutang_ids)).delete(synchronize_session=False)
    db.query(HutangUsaha).filter(HutangUsaha.nomor_referensi == nomor).delete(synchronize_session=False)
    db.query(KasBank).filter(KasBank.nomor_referensi == nomor).delete(synchronize_session=False)
    db.query(TransaksiPenjualanMobil).filter(TransaksiPenjualanMobil.nomor_transaksi == nomor).delete(synchronize_session=False)
    m = db.get(Mobil, mobil_id)
    if m is not None:
        db.delete(m)
    db.commit()


def _kas(db, nomor, tipe):
    return db.query(KasBank).filter(
        KasBank.nomor_referensi == nomor,
        KasBank.sumber == KasBankSource.JUAL_BELI_MOBIL,
        KasBank.tipe == tipe,
    ).all()


def test_cancel_sale_hutang_tidak_menggerakkan_kas():
    db = SessionLocal()
    mobil_id = _mobil_uji(db).id
    nomor = None
    try:
        trx = _jual_lunas(db, mobil_id)
        nomor = trx.nomor_transaksi
        masuk_awal = sum(k.nominal for k in _kas(db, nomor, KasBankType.MASUK))

        PenjualanMobilService(db).cancel_sale(trx.id, alasan="uji", refund_mode="HUTANG")

        assert _kas(db, nomor, KasBankType.KELUAR) == []
        assert sum(k.nominal for k in _kas(db, nomor, KasBankType.MASUK)) == masuk_awal
        hutang = db.query(HutangUsaha).filter(
            HutangUsaha.nomor_referensi == nomor,
            HutangUsaha.sumber == HutangSource.UANG_MUKA_PENJUALAN,
        ).one()
        assert hutang.nominal_hutang == masuk_awal
    finally:
        if nomor:
            _bersihkan(db, nomor, mobil_id)
        db.close()


def test_cancel_sale_langsung_balik_kas_ke_kas_pilihan():
    db = SessionLocal()
    mobil_id = _mobil_uji(db).id
    nomor = None
    try:
        trx = _jual_lunas(db, mobil_id)
        nomor = trx.nomor_transaksi

        PenjualanMobilService(db).cancel_sale(
            trx.id, alasan="uji", refund_mode="LANGSUNG",
            refund_kas={"metode": PaymentMethod.TUNAI, "kas_jenis": KasBankJenis.KAS_UTAMA},
        )

        keluar = _kas(db, nomor, KasBankType.KELUAR)
        assert sum(k.nominal for k in keluar) == HARGA
        assert all(k.jenis == KasBankJenis.KAS_UTAMA for k in keluar)
        assert db.query(HutangUsaha).filter(HutangUsaha.nomor_referensi == nomor).count() == 0
    finally:
        if nomor:
            _bersihkan(db, nomor, mobil_id)
        db.close()
