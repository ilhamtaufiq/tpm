"""
Regresi: void transaksi bengkel tidak boleh menghapus kas transaksi lain yang
kebetulan punya referensi_id sama dengan transaksi.id.

Kasus produksi 13-10-2026: void BGL2610130004 (id 31) menghapus kas pembayaran
piutang PTG2610050006 (referensi_id = pembayaran #31, "RETUR KIT TURBO" 350.000).
"""
from datetime import date
from decimal import Decimal

from app.database import SessionLocal
from app.models.keuangan import KasBank
from app.schemas.bengkel import DetailServiceCreate, TransaksiBengkelCreate
from app.services.kas_bank_integration import create_kas_entry
from app.services.transaksi_bengkel_service import TransaksiBengkelService
from app.utils.constants import KasBankJenis, KasBankSource, KasBankType, PaymentMethod, WorkshopStatus


def test_void_bengkel_tidak_menghapus_kas_pembayaran_piutang_lain():
    db = SessionLocal()
    asing_id = None
    try:
        service = TransaksiBengkelService(db)
        transaksi = service.create(
            TransaksiBengkelCreate(
                tanggal=date.today(),
                kategori="umum",
                detail_parts=[],
                detail_services=[DetailServiceCreate(nama_jasa="Jasa Test", harga=Decimal("100000"), qty=1)],
                status_pengerjaan=WorkshopStatus.SELESAI,
                metode_bayar=PaymentMethod.TUNAI,
                jumlah_bayar=Decimal("100000"),
            ),
            user_id=None,
        )

        # Kas pembayaran piutang lain yang referensi_id-nya kebetulan = transaksi.id.
        asing = create_kas_entry(
            db=db,
            tanggal=date.today(),
            tipe=KasBankType.MASUK,
            nominal=Decimal("350000"),
            sumber=KasBankSource.BENGKEL,
            metode_bayar=PaymentMethod.TUNAI,
            referensi_id=transaksi.id,
            nomor_referensi="PTG-TEST-VOIDCOLLIDE",
            keterangan="[Bengkel] DP PTG-TEST-VOIDCOLLIDE - RETUR (TUNAI)",
            kas_jenis=KasBankJenis.KAS_UTAMA,
        )
        asing_id = asing.id

        assert service.void_transaction(transaksi.id)
        db.expire_all()

        assert db.get(KasBank, asing_id) is not None, "kas pembayaran piutang lain ikut terhapus"
        sisa_kas_transaksi = db.query(KasBank).filter(
            KasBank.nomor_referensi == transaksi.nomor_transaksi,
            KasBank.sumber == KasBankSource.BENGKEL,
        ).count()
        assert sisa_kas_transaksi == 0
    finally:
        db.rollback()
        if asing_id is not None:
            db.query(KasBank).filter(KasBank.id == asing_id).delete(synchronize_session=False)
            db.commit()
        db.close()
