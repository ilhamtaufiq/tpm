"""Muatan jasa angkut yang sempat diubah ke LUNAS lalu kembali BELUM_LUNAS: piutang harus terbuka lagi
dengan pembayaran asli, dan kas dari pelunasan muatan (yang sudah dibatalkan) harus hilang."""
from datetime import date
from decimal import Decimal

from app.database.connection import SessionLocal
from app.models.jasa_angkut import JasaAngkutBiayaLainnya, MuatanJasaAngkut, ArmadaJasaAngkut, Supir
from app.models.keuangan import KasBank, PembayaranPiutang, PiutangUsaha
from app.schemas.jasa_angkut import BiayaItem, MuatanCreate, MuatanUpdate, PaymentDetail
from app.services.muatan_service import MuatanService
from app.utils.constants import KasBankSource, KasBankType, PaymentMethod, PaymentStatus, PiutangSource, PiutangStatus


def test_muatan_lunas_lalu_belum_lunas_membuka_lagi_piutang():
    db = SessionLocal()
    mid = None
    nomor = None
    try:
        supir = db.query(Supir).filter(Supir.is_active == True).first()  # noqa: E712
        armada = db.query(ArmadaJasaAngkut).filter(ArmadaJasaAngkut.is_active == True).first()  # noqa: E712
        service = MuatanService(db)

        muatan = service.create(MuatanCreate(
            tanggal=date(2026, 9, 1),
            supir_id=supir.id if supir else None,
            armada_id=armada.id if armada else None,
            asal="UJI FLIP Asal",
            tujuan="UJI FLIP Tujuan",
            jenis_muatan="UJI FLIP",
            ritase=1,
            harga_beli=Decimal("500000"),
            harga_jual=Decimal("1000000"),
            status_bayar=PaymentStatus.BELUM_LUNAS,
            metode_bayar=PaymentMethod.TUNAI,
            biaya_operasional=[BiayaItem(deskripsi="UJI FLIP Tol", jumlah=Decimal("50000"))],
            payments=[PaymentDetail(metode="TUNAI", nominal=Decimal("100000"), kas_jenis="KAS_UNIT_JASA_ANGKUT")],
        ), user_id=None)
        mid = muatan.id
        nomor = muatan.nomor_transaksi

        # Salah klik: dijadikan LUNAS, lalu dikembalikan BELUM_LUNAS
        service.update(mid, MuatanUpdate(status_bayar=PaymentStatus.LUNAS))
        service.update(mid, MuatanUpdate(status_bayar=PaymentStatus.BELUM_LUNAS))

        db.expire_all()
        piutang = db.query(PiutangUsaha).filter(
            PiutangUsaha.referensi_id == mid,
            PiutangUsaha.sumber == PiutangSource.JASA_ANGKUT,
        ).first()
        assert piutang is not None
        assert piutang.status != PiutangStatus.LUNAS, "piutang harus terbuka lagi setelah kembali BELUM_LUNAS"
        assert piutang.total_dibayar == Decimal("100000"), "hanya pembayaran asli yang dihitung"
        assert piutang.sisa_piutang == piutang.nominal_piutang - Decimal("100000")
        assert db.query(PembayaranPiutang).filter(PembayaranPiutang.piutang_id == piutang.id).count() == 1

        kas_muatan = db.query(KasBank).filter(
            KasBank.referensi_id == mid,
            KasBank.nomor_referensi == nomor,
            KasBank.sumber == KasBankSource.JASA_ANGKUT,
            KasBank.tipe == KasBankType.MASUK,
        ).count()
        assert kas_muatan == 0, "kas pelunasan muatan harus dihapus saat kembali BELUM_LUNAS"
    finally:
        if mid is not None:
            piutang_ids = [p.id for p in db.query(PiutangUsaha).filter(PiutangUsaha.referensi_id == mid).all()]
            if piutang_ids:
                db.query(PembayaranPiutang).filter(PembayaranPiutang.piutang_id.in_(piutang_ids)).delete(synchronize_session=False)
            db.query(KasBank).filter(KasBank.nomor_referensi == nomor).delete(synchronize_session=False)
            db.query(PiutangUsaha).filter(PiutangUsaha.referensi_id == mid).delete(synchronize_session=False)
            db.query(JasaAngkutBiayaLainnya).filter(JasaAngkutBiayaLainnya.muatan_id == mid).delete(synchronize_session=False)
            db.query(MuatanJasaAngkut).filter(MuatanJasaAngkut.id == mid).delete(synchronize_session=False)
            db.commit()
        db.close()
