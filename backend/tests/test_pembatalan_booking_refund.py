"""Pembatalan booking JB Mobil: pilihan refund DP langsung atau tidak langsung.

- HUTANG (default): sisa DP jadi hutang uang muka penjualan, kas tidak berubah.
- LANGSUNG: sisa DP keluar dari kas sekarang sesuai metode/kas yang dipilih,
  total baris refund harus sama dengan sisa DP, tanpa hutang baru.
Invarian: refund langsung + penalti = DP terbayar (tidak ada selisih kas).
"""
from datetime import date
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func

from app.database.connection import SessionLocal
from app.models.keuangan import HutangUsaha, KasBank, PiutangUsaha
from app.models.mobil import Mobil, TransaksiPenjualanMobil
from app.schemas.mobil import PaymentItem, TransaksiMobilCreate
from app.services.data_import_service import DataImportService
from app.services.kas_bank_integration import create_kas_entry
from app.services.penjualan_mobil_service import PenjualanMobilService
from app.utils.constants import (
    HutangSource,
    KasBankJenis,
    KasBankSource,
    KasBankType,
    PaymentMethod,
)

HARGA = Decimal("10000000")
DP = Decimal("2000000")
PENALTI = Decimal("500000")


PLAT_UJI = "T 8888 REFUND"
SEED_KET = "SEED UJI REFUND BOOKING"


def _mobil_uji(db) -> Mobil:
    """Mobil TERSEDIA khusus uji (dibuat sendiri agar tes tidak vakum di DB kosong)."""
    db.query(Mobil).filter(Mobil.nomor_plat == PLAT_UJI).delete(synchronize_session=False)
    db.commit()
    res = DataImportService(db)._apply_mobil(
        [{
            "_row": 2, "merek": "UJI", "model": "REFUND", "tahun": 2020,
            "warna": "PUTIH", "nomor_plat": PLAT_UJI, "harga_beli": 100000000,
        }],
        dry=False,
        user_id=None,
    )
    assert res["errors"] == [] and res["created"] == 1
    db.flush()
    return db.query(Mobil).filter(Mobil.nomor_plat == PLAT_UJI).one()


def _buat_booking(db, mobil_id: int) -> TransaksiPenjualanMobil:
    svc = PenjualanMobilService(db)
    return svc.create(TransaksiMobilCreate(
        tanggal=date(2026, 9, 18),
        mobil_id=mobil_id,
        nama_pembeli="TEST REFUND BOOKING",
        harga_jual=HARGA,
        dp=DP,
        metode_bayar="TRANSFER",
        payments=[PaymentItem(metode="TRANSFER", nominal=DP)],
    ), user_id=None)


def _bersihkan(db, nomor: str, mobil_id: int):
    piutang_ids = [p.id for p in db.query(PiutangUsaha.id).filter(
        PiutangUsaha.nomor_referensi == nomor).all()]
    if piutang_ids:
        from app.models.keuangan import PembayaranPiutang
        db.query(PembayaranPiutang).filter(
            PembayaranPiutang.piutang_id.in_(piutang_ids)
        ).delete(synchronize_session=False)
        db.query(PiutangUsaha).filter(PiutangUsaha.id.in_(piutang_ids)).delete(
            synchronize_session=False)
    db.query(HutangUsaha).filter(HutangUsaha.nomor_referensi == nomor).delete(
        synchronize_session=False)
    db.query(KasBank).filter(KasBank.nomor_referensi == nomor).delete(
        synchronize_session=False)
    db.query(KasBank).filter(KasBank.keterangan == SEED_KET).delete(synchronize_session=False)
    db.query(TransaksiPenjualanMobil).filter(
        TransaksiPenjualanMobil.nomor_transaksi == nomor
    ).delete(synchronize_session=False)
    m = db.get(Mobil, mobil_id)
    if m is not None:
        db.delete(m)
    db.commit()


def _kas_by_tipe(db, nomor: str, tipe: KasBankType) -> list:
    return db.query(KasBank).filter(
        KasBank.nomor_referensi == nomor,
        KasBank.sumber == KasBankSource.JUAL_BELI_MOBIL,
        KasBank.tipe == tipe,
    ).all()


def test_cancel_booking_refund_hutang_tidak_menggerakkan_kas():
    db = SessionLocal()
    mobil_id = _mobil_uji(db).id
    nomor = None
    try:
        trx = _buat_booking(db, mobil_id)
        nomor = trx.nomor_transaksi
        kas_masuk_awal = sum(k.nominal for k in _kas_by_tipe(db, nomor, KasBankType.MASUK))

        PenjualanMobilService(db).cancel_booking(
            trx.id, penalti=PENALTI, refund_mode="HUTANG", alasan="uji",
        )

        hutang = db.query(HutangUsaha).filter(
            HutangUsaha.nomor_referensi == nomor,
            HutangUsaha.sumber == HutangSource.UANG_MUKA_PENJUALAN,
        ).one()
        assert hutang.nominal_hutang == DP - PENALTI
        assert _kas_by_tipe(db, nomor, KasBankType.KELUAR) == []
        kas_masuk_akhir = sum(k.nominal for k in _kas_by_tipe(db, nomor, KasBankType.MASUK))
        assert kas_masuk_akhir == kas_masuk_awal
    finally:
        if nomor:
            _bersihkan(db, nomor, mobil_id)
        db.close()


def test_cancel_booking_refund_langsung_keluar_dari_kas_pilihan():
    db = SessionLocal()
    mobil_id = _mobil_uji(db).id
    nomor = None
    try:
        trx = _buat_booking(db, mobil_id)
        nomor = trx.nomor_transaksi
        refund = DP - PENALTI
        # Saldo KAS_UTAMA harus cukup, kalau tidak refund ditolak (guard saldo).
        create_kas_entry(
            db=db, tanggal=date.today(), tipe=KasBankType.MASUK, nominal=refund,
            sumber=KasBankSource.MODAL, metode_bayar=PaymentMethod.TUNAI,
            referensi_id=None, nomor_referensi=None,
            keterangan=SEED_KET, kas_jenis=KasBankJenis.KAS_UTAMA, commit=True,
        )

        PenjualanMobilService(db).cancel_booking(
            trx.id,
            penalti=PENALTI,
            refund_mode="LANGSUNG",
            refund_payments=[{
                "metode": PaymentMethod.TUNAI,
                "kas_jenis": KasBankJenis.KAS_UTAMA,
                "nominal": refund,
            }],
            alasan="uji",
        )

        kas_keluar = _kas_by_tipe(db, nomor, KasBankType.KELUAR)
        assert len(kas_keluar) == 1
        assert kas_keluar[0].nominal == refund
        assert kas_keluar[0].jenis == KasBankJenis.KAS_UTAMA
        assert db.query(HutangUsaha).filter(HutangUsaha.nomor_referensi == nomor).count() == 0
    finally:
        if nomor:
            _bersihkan(db, nomor, mobil_id)
        db.close()


def test_cancel_booking_refund_langsung_total_harus_sama_sisa_dp():
    db = SessionLocal()
    mobil_id = _mobil_uji(db).id
    nomor = None
    try:
        trx = _buat_booking(db, mobil_id)
        nomor = trx.nomor_transaksi
        try:
            PenjualanMobilService(db).cancel_booking(
                trx.id,
                penalti=PENALTI,
                refund_mode="LANGSUNG",
                refund_payments=[{
                    "metode": PaymentMethod.TRANSFER,
                    "kas_jenis": KasBankJenis.BANK_UTAMA,
                    "nominal": DP,  # salah: tanpa potongan penalti
                }],
            )
            raise AssertionError("refund langsung yang tidak sesuai seharusnya ditolak")
        except HTTPException as exc:
            assert exc.status_code == 400
        db.rollback()
        assert _kas_by_tipe(db, nomor, KasBankType.KELUAR) == []
    finally:
        if nomor:
            _bersihkan(db, nomor, mobil_id)
        db.close()
