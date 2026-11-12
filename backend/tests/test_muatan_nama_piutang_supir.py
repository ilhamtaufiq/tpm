"""Piutang supir dari muatan jasa angkut diberi akhiran unit: "<nama supir> - Jasa Angkut" (invarian 36)."""
from datetime import date
from decimal import Decimal

from app.database.connection import SessionLocal
from app.models.jasa_angkut import JasaAngkutBiayaLainnya, MuatanJasaAngkut, Supir
from app.models.keuangan import KasBank, PiutangUsaha
from app.schemas.jasa_angkut import MuatanCreate
from app.services.muatan_service import MuatanService
from app.utils.constants import PaymentMethod, PaymentStatus, PiutangSource


def test_piutang_supir_muatan_memakai_akhiran_jasa_angkut():
    db = SessionLocal()
    mid = None
    try:
        supir = db.query(Supir).filter(Supir.kode == "UJI-SUPIR-NAMA").first()
        if supir is None:
            supir = Supir(kode="UJI-SUPIR-NAMA", nama="UJI Supir Nama", tanggal_bergabung=date(2026, 1, 1), is_active=True)
            db.add(supir)
            db.commit()
            supir_dibuat = True
        else:
            supir_dibuat = False
        muatan = MuatanService(db).create(MuatanCreate(
            tanggal=date(2026, 9, 2),
            supir_id=supir.id,
            asal="UJI NAMA Asal",
            tujuan="UJI NAMA Tujuan",
            jenis_muatan="UJI NAMA",
            ritase=1,
            harga_beli=Decimal("500000"),
            harga_jual=Decimal("1000000"),
            status_bayar=PaymentStatus.BELUM_LUNAS,
            metode_bayar=PaymentMethod.TUNAI,
            biaya_operasional=[],
            payments=[],
        ), user_id=None)
        mid = muatan.id

        db.expire_all()
        piutang = db.query(PiutangUsaha).filter(
            PiutangUsaha.referensi_id == mid,
            PiutangUsaha.sumber == PiutangSource.JASA_ANGKUT,
        ).first()
        assert piutang is not None
        assert piutang.nama_debitur == f"{supir.nama} - Jasa Angkut"
    finally:
        if mid is not None:
            db.rollback()
            db.query(PiutangUsaha).filter(PiutangUsaha.referensi_id == mid, PiutangUsaha.sumber == PiutangSource.JASA_ANGKUT).delete(synchronize_session=False)
            db.query(KasBank).filter(KasBank.referensi_id == mid).delete(synchronize_session=False)
            db.query(JasaAngkutBiayaLainnya).filter(JasaAngkutBiayaLainnya.muatan_id == mid).delete(synchronize_session=False)
            db.query(MuatanJasaAngkut).filter(MuatanJasaAngkut.id == mid).delete(synchronize_session=False)
            db.commit()
        if 'supir_dibuat' in locals() and supir_dibuat:
            db.query(Supir).filter(Supir.kode == "UJI-SUPIR-NAMA").delete(synchronize_session=False)
            db.commit()
        db.close()
