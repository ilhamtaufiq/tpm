"""Pembayaran hutang hanya boleh TUNAI atau TRANSFER, dan keterangan kas memuat metodenya.

Sesuai PaymentModal (frontend) yang hanya menawarkan Tunai dan Transfer untuk hutang.
Metode lain (KREDIT, SPLIT, INTERNAL) ditolak di schema sebelum menyentuh kas.
"""
from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.database import SessionLocal
from app.models.keuangan import HutangUsaha, KasBank, PembayaranHutang
from app.schemas.keuangan import HutangCreate, PembayaranHutangCreate, PembayaranHutangSplit
from app.services.hutang_service import HutangService
from app.services.kas_bank_integration import create_kas_entry
from app.utils.constants import HutangSource, KasBankJenis, KasBankSource, KasBankType, PaymentMethod


@pytest.mark.parametrize("metode", [PaymentMethod.KREDIT, PaymentMethod.SPLIT, PaymentMethod.INTERNAL])
def test_schema_menolak_metode_selain_tunai_transfer(metode):
    with pytest.raises(ValidationError):
        PembayaranHutangCreate(hutang_id=1, tanggal=date.today(), nominal=Decimal("1000"), metode_bayar=metode)

    with pytest.raises(ValidationError):
        PembayaranHutangSplit(
            hutang_id=1,
            tanggal=date.today(),
            payments=[{"metode": metode, "nominal": Decimal("1000")}],
        )


def test_keterangan_kas_pembayaran_hutang_memuat_metode():
    db = SessionLocal()
    hutang_id = None
    kas_ids = []
    pembayaran_ids = []
    try:
        # Saldo awal supaya pembayaran tidak ditolak karena saldo tidak mencukupi.
        for metode, jenis in [(PaymentMethod.TUNAI, KasBankJenis.KAS_UTAMA), (PaymentMethod.TRANSFER, KasBankJenis.BANK_BCA)]:
            seed = create_kas_entry(
                db=db,
                tanggal=date.today(),
                tipe=KasBankType.MASUK,
                nominal=Decimal("100000"),
                sumber=KasBankSource.HUTANG,
                metode_bayar=metode,
                referensi_id=None,
                nomor_referensi="SALDO-TEST-HUTANG-METODE",
                keterangan="Saldo awal test keterangan hutang",
                kas_jenis=jenis,
            )
            kas_ids.append(seed.id)
        hutang = HutangService(db).create(
            HutangCreate(
                tanggal=date.today(),
                sumber=HutangSource.LAINNYA,
                nama_kreditur="Kreditur Test Metode",
                nominal_hutang=Decimal("200000"),
            ),
        )
        hutang_id = hutang.id

        hasil = HutangService(db).process_payment_split(
            PembayaranHutangSplit(
                hutang_id=hutang_id,
                tanggal=date.today(),
                payments=[
                    {"metode": PaymentMethod.TUNAI, "nominal": Decimal("50000")},
                    {"metode": PaymentMethod.TRANSFER, "nominal": Decimal("50000")},
                ],
            ),
        )
        pembayaran_ids = [p.id for p in hasil]

        kas = (
            db.query(KasBank)
            .filter(KasBank.nomor_referensi == hutang.nomor_hutang)
            .order_by(KasBank.id)
            .all()
        )
        kas_ids += [k.id for k in kas]
        keterangan = [k.keterangan for k in kas]
        assert len(kas) == 2
        assert keterangan[0].endswith("(TUNAI)")
        assert keterangan[1].endswith("(TRANSFER)")
    finally:
        db.rollback()
        if kas_ids:
            db.query(KasBank).filter(KasBank.id.in_(kas_ids)).delete(synchronize_session=False)
        if pembayaran_ids:
            db.query(PembayaranHutang).filter(PembayaranHutang.id.in_(pembayaran_ids)).delete(synchronize_session=False)
        if hutang_id is not None:
            db.query(HutangUsaha).filter(HutangUsaha.id == hutang_id).delete(synchronize_session=False)
        db.commit()
        db.close()
