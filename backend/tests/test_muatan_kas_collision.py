"""
Regresi: edit/void muatan tidak boleh menyentuh kas transaksi lain yang
kebetulan punya referensi_id sama dengan muatan.id.

Kasus produksi 13-10-2026: kas pembayaran piutang (referensi_id = pembayaran.id,
nomor_referensi = AR.../PTG...) tertimpa nominal laba_tpm muatan lain dan
dipindah ke KAS_UNIT_JASA_ANGKUT saat muatan di-update menjadi LUNAS.
"""
from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy import func

from app.database.connection import SessionLocal
from app.models.jasa_angkut import ArmadaJasaAngkut, MuatanJasaAngkut, Supir
from app.models.keuangan import KasBank, PiutangUsaha
from app.schemas.jasa_angkut import MuatanCreate, MuatanUpdate
from app.services.kas_bank_integration import create_kas_entry
from app.services.kas_bank_service import KasBankService
from app.services.muatan_service import MuatanService
from app.utils.constants import (
    KasBankJenis,
    KasBankSource,
    KasBankType,
    PaymentMethod,
    PaymentStatus,
    PiutangStatus,
)


def test_update_dan_void_muatan_tidak_menimpa_kas_lain():
    db = SessionLocal()
    muatan_id = None
    try:
        supir = db.query(Supir).filter(Supir.is_active == True).first()  # noqa: E712
        armada = db.query(ArmadaJasaAngkut).filter(ArmadaJasaAngkut.is_active == True).first()  # noqa: E712
        service = MuatanService(db)
        tanggal = date(2026, 9, 20)
        max_kas_id_before = db.query(func.max(KasBank.id)).scalar() or 0

        muatan = service.create(
            MuatanCreate(
                tanggal=tanggal,
                supir_id=supir.id if supir else None,
                armada_id=armada.id if armada else None,
                asal="Test Collide",
                tujuan="Test Collide",
                jenis_muatan="Pasir",
                ritase=1,
                harga_beli=Decimal("500000"),
                harga_jual=Decimal("1000000"),
                status_bayar=PaymentStatus.BELUM_LUNAS,
                metode_bayar=PaymentMethod.TUNAI,
            ),
            user_id=None,
        )
        muatan_id = muatan.id

        # Kas pembayaran piutang lain yang referensi_id-nya kebetulan = muatan.id.
        asing = create_kas_entry(
            db=db,
            tanggal=tanggal,
            tipe=KasBankType.MASUK,
            nominal=Decimal("1100000"),
            sumber=KasBankSource.JASA_ANGKUT,
            metode_bayar=PaymentMethod.TRANSFER,
            referensi_id=muatan.id,
            nomor_referensi="PTG-TEST-COLLIDE",
            keterangan="[JASA ANGKUT] Pembayaran Piutang PTG-TEST-COLLIDE",
            kas_jenis=KasBankJenis.BANK_BCA,
        )
        asing_id = asing.id

        # Update menjadi LUNAS + ubah harga → dulu menimpa kas asing.
        service.update(
            muatan.id,
            MuatanUpdate(
                status_bayar=PaymentStatus.LUNAS,
                metode_bayar=PaymentMethod.TUNAI,
                harga_jual=Decimal("1200000"),
            ),
        )
        db.expire_all()

        asing = db.get(KasBank, asing_id)
        assert asing.nominal == Decimal("1100000")
        assert asing.jenis == KasBankJenis.BANK_BCA
        assert asing.metode_bayar == PaymentMethod.TRANSFER

        muatan = db.get(MuatanJasaAngkut, muatan.id)
        kas_muatan = db.query(KasBank).filter(
            KasBank.id > max_kas_id_before,
            KasBank.nomor_referensi == muatan.nomor_transaksi,
            KasBank.tipe == KasBankType.MASUK,
        ).all()
        assert len(kas_muatan) == 1, "Pemasukan muatan harus tercatat di kas miliknya sendiri"

        # Ganti tanggal muatan → kas asing tidak ikut pindah tanggal.
        service.update(muatan.id, MuatanUpdate(tanggal=date(2026, 9, 21)))
        db.expire_all()
        assert db.get(KasBank, asing_id).tanggal == tanggal

        # Void muatan → kas asing tidak ikut dibalik.
        service.void_muatan(muatan.id)
        db.expire_all()
        reversal_asing = db.query(KasBank).filter(
            KasBank.id > max_kas_id_before,
            KasBank.nomor_referensi == "PTG-TEST-COLLIDE",
            KasBank.keterangan.ilike("[VOID]%"),
        ).count()
        assert reversal_asing == 0
        reversal_muatan = db.query(KasBank).filter(
            KasBank.id > max_kas_id_before,
            KasBank.nomor_referensi == muatan.nomor_transaksi,
            KasBank.keterangan.ilike("[VOID]%"),
        ).count()
        assert reversal_muatan == 1
    finally:
        db.rollback()
        # Pastikan data test tidak tertinggal aktif (mengganggu invarian global).
        if muatan_id is not None:
            sisa = db.get(MuatanJasaAngkut, muatan_id)
            if sisa is not None and sisa.status_bayar != PaymentStatus.BATAL:
                MuatanService(db).void_muatan(muatan_id)
        # Kas "asing" yang dibuat test ini dibersihkan, supaya saldo DB tidak bocor ke test lain.
        db.query(KasBank).filter(KasBank.nomor_referensi == "PTG-TEST-COLLIDE").delete(synchronize_session=False)
        db.commit()
        KasBankService(db).rebuild_balances()
        db.close()


def test_edit_muatan_yang_lunas_via_piutang_tidak_mencatat_kas_ganda():
    """Kasus JAS2610130014: lunas lewat pembayaran piutang (kas di nomor piutang),
    lalu muatan diedit → dulu dibuat lagi kas 'Pemasukan Jasa Angkut' (dobel)."""
    db = SessionLocal()
    muatan_id = None
    try:
        service = MuatanService(db)
        max_kas_id_before = db.query(func.max(KasBank.id)).scalar() or 0
        muatan = service.create(
            MuatanCreate(
                tanggal=date(2026, 9, 22),
                asal="Test Ganda",
                tujuan="Test Ganda",
                jenis_muatan="Pasir",
                ritase=1,
                harga_beli=Decimal("500000"),
                harga_jual=Decimal("1000000"),
                status_bayar=PaymentStatus.BELUM_LUNAS,
                metode_bayar=PaymentMethod.TRANSFER,
            ),
            user_id=None,
        )
        muatan_id = muatan.id
        service.mark_paid(muatan_id, metode_bayar=PaymentMethod.TRANSFER)

        def kas_masuk():
            db.expire_all()
            return db.query(func.coalesce(func.sum(KasBank.nominal), 0)).filter(
                KasBank.id > max_kas_id_before,
                KasBank.tipe == KasBankType.MASUK,
            ).scalar()

        sebelum = kas_masuk()
        assert sebelum > 0

        service.update(muatan_id, MuatanUpdate(harga_jual=Decimal("1100000")))
        assert kas_masuk() == sebelum

        # Harga naik setelah lunas → piutang dibuka lagi sebesar selisihnya.
        muatan = db.get(MuatanJasaAngkut, muatan_id)
        piutang = db.query(PiutangUsaha).filter(
            PiutangUsaha.nomor_referensi == muatan.nomor_transaksi
        ).one()
        assert muatan.status_bayar == PaymentStatus.BELUM_LUNAS
        assert piutang.status == PiutangStatus.SEBAGIAN
        assert piutang.sisa_piutang == piutang.nominal_piutang - sebelum
        assert piutang.sisa_piutang > 0

        # Lunasi selisihnya, lalu turunkan harga di bawah yang sudah dibayar → ditolak.
        service.mark_paid(muatan_id, metode_bayar=PaymentMethod.TRANSFER)
        with pytest.raises(HTTPException) as err:
            service.update(muatan_id, MuatanUpdate(harga_jual=Decimal("900000")))
        assert err.value.status_code == 400
        db.expire_all()
        assert db.get(MuatanJasaAngkut, muatan_id).harga_jual == Decimal("1100000")
    finally:
        db.rollback()
        if muatan_id is not None:
            sisa = db.get(MuatanJasaAngkut, muatan_id)
            if sisa is not None and sisa.status_bayar != PaymentStatus.BATAL:
                MuatanService(db).void_muatan(muatan_id)
        # Kas "asing" yang dibuat test ini dibersihkan, supaya saldo DB tidak bocor ke test lain.
        db.query(KasBank).filter(KasBank.nomor_referensi == "PTG-TEST-COLLIDE").delete(synchronize_session=False)
        db.commit()
        KasBankService(db).rebuild_balances()
        db.close()
