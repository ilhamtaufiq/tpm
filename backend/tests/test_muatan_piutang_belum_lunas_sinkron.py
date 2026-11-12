"""Muatan BELUM_LUNAS: saat pendapatan diedit, piutang supir ikut menyesuaikan dengan bagian TPM terbaru."""
from datetime import date
from decimal import Decimal

from app.database.connection import SessionLocal
from app.models.jasa_angkut import JasaAngkutBiayaLainnya, MuatanJasaAngkut, Supir
from app.models.keuangan import KasBank, PiutangUsaha
from app.schemas.jasa_angkut import MuatanCreate, MuatanUpdate
from app.services.muatan_service import MuatanService
from app.utils.constants import PaymentMethod, PaymentStatus, PiutangSource


def test_piutang_belum_lunas_ikut_berubah_saat_pendapatan_diedit():
    db = SessionLocal()
    mid = None
    supir_dibuat = False
    try:
        supir = db.query(Supir).filter(Supir.kode == "UJI-SUPIR-SINKRON").first()
        if supir is None:
            supir = Supir(kode="UJI-SUPIR-SINKRON", nama="UJI Supir Sinkron", tanggal_bergabung=date(2026, 1, 1), is_active=True)
            db.add(supir)
            db.commit()
            supir_dibuat = True

        service = MuatanService(db)
        muatan = service.create(MuatanCreate(
            tanggal=date(2026, 9, 3),
            supir_id=supir.id,
            asal="UJI SINKRON Asal",
            tujuan="UJI SINKRON Tujuan",
            jenis_muatan="UJI SINKRON",
            ritase=1,
            harga_beli=Decimal("500000"),
            harga_jual=Decimal("1000000"),
            status_bayar=PaymentStatus.BELUM_LUNAS,
            metode_bayar=PaymentMethod.TUNAI,
            biaya_operasional=[],
            payments=[],
        ), user_id=None)
        mid = muatan.id
        nomor = muatan.nomor_transaksi

        db.expire_all()
        piutang = db.query(PiutangUsaha).filter(
            PiutangUsaha.referensi_id == mid, PiutangUsaha.sumber == PiutangSource.JASA_ANGKUT,
            PiutangUsaha.nomor_referensi == nomor,
        ).first()
        assert piutang is not None
        laba_awal = Decimal(str(db.query(MuatanJasaAngkut).get(mid).laba_tpm))
        assert piutang.nominal_piutang == laba_awal

        # Pendapatan dinaikkan: bagian TPM ikut naik, piutang harus mengikuti
        service.update(mid, MuatanUpdate(harga_jual=Decimal("2000000")))

        db.expire_all()
        muatan = db.query(MuatanJasaAngkut).get(mid)
        piutang = db.query(PiutangUsaha).filter(
            PiutangUsaha.referensi_id == mid, PiutangUsaha.sumber == PiutangSource.JASA_ANGKUT,
            PiutangUsaha.nomor_referensi == nomor,
        ).first()
        assert Decimal(str(muatan.laba_tpm)) > laba_awal
        assert piutang.nominal_piutang == Decimal(str(muatan.laba_tpm)), "piutang harus sama dengan bagian TPM terbaru"
        assert piutang.sisa_piutang == piutang.nominal_piutang
    finally:
        if mid is not None:
            db.rollback()
            db.query(PiutangUsaha).filter(PiutangUsaha.referensi_id == mid, PiutangUsaha.sumber == PiutangSource.JASA_ANGKUT).delete(synchronize_session=False)
            db.query(KasBank).filter(KasBank.referensi_id == mid).delete(synchronize_session=False)
            db.query(JasaAngkutBiayaLainnya).filter(JasaAngkutBiayaLainnya.muatan_id == mid).delete(synchronize_session=False)
            db.query(MuatanJasaAngkut).filter(MuatanJasaAngkut.id == mid).delete(synchronize_session=False)
            db.commit()
        if supir_dibuat:
            db.query(Supir).filter(Supir.kode == "UJI-SUPIR-SINKRON").delete(synchronize_session=False)
            db.commit()
        db.close()
