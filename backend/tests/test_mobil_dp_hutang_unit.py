"""Regresi: hutang sisa pembelian mobil (DP) harus punya unit JUAL_BELI_MOBIL.

Bug asal: `MobilService.create` membuat `HutangUsaha` sumber PEMBELIAN_MOBIL tanpa `unit`.
Menu Keuangan JB Mobil hanya menampilkan hutang ber-unit JUAL_BELI_MOBIL, jadi sisa
hutang (harga beli − DP) tidak muncul di sana.
"""
from datetime import date
from decimal import Decimal

from app.database.connection import SessionLocal
from app.models.keuangan import HutangUsaha, KasBank
from app.models.mobil import Mobil
from app.schemas.mobil import MobilCreate
from app.services.mobil_service import MobilService
from app.utils.constants import HutangSource, KasBankJenis, KasBankSource, PaymentMethod, PaymentStatus

PLAT = "TEST-DPUNIT"


def _bersihkan(db):
    mobil = db.query(Mobil).filter(Mobil.nomor_plat == PLAT).first()
    if mobil is None:
        return
    db.query(HutangUsaha).filter(
        HutangUsaha.sumber == HutangSource.PEMBELIAN_MOBIL, HutangUsaha.referensi_id == mobil.id
    ).delete(synchronize_session=False)
    db.query(KasBank).filter(KasBank.nomor_referensi == mobil.kode).delete(synchronize_session=False)
    db.delete(mobil)
    db.commit()


def test_hutang_sisa_dp_beli_mobil_masuk_unit_jual_beli_mobil():
    db = SessionLocal()
    _bersihkan(db)
    try:
        data = MobilCreate(
            merek="UJI", model="DP", tahun=2020, warna="Hitam", nomor_plat=PLAT,
            harga_beli=Decimal("5000000"), tanggal_masuk=date.today(),
            status_bayar=PaymentStatus.BELUM_LUNAS, metode_bayar=PaymentMethod.TUNAI,
            dp=Decimal("1000000"), kas_jenis=KasBankJenis.KAS_UNIT_MOBIL,
        )
        mobil = MobilService(db).create(data)
        hutang = db.query(HutangUsaha).filter(
            HutangUsaha.sumber == HutangSource.PEMBELIAN_MOBIL, HutangUsaha.referensi_id == mobil.id
        ).one()
        assert hutang.unit == KasBankSource.JUAL_BELI_MOBIL
        assert hutang.sisa_hutang == Decimal("4000000")
    finally:
        db.rollback()
        _bersihkan(db)
        db.close()
