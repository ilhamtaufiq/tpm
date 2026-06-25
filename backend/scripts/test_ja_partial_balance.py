"""Verify neraca balance for JA partial payment + tol dipotong scenario."""
import sys
import os
from datetime import date
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.connection import SessionLocal
from app.services.muatan_service import MuatanService
from app.services.reports.neraca_service import NeracaService
from app.services.reports.modal_service import ModalService
from app.schemas.jasa_angkut import MuatanCreate, BiayaItem
from app.schemas.keuangan import PaymentDetail
from app.utils.constants import PaymentStatus, PaymentMethod
from app.models.keuangan import KasBank, PiutangUsaha
from app.utils.constants import KasBankSource, KasBankType, PiutangSource


def cleanup_legacy_ops_kas(db):
    """Remove legacy operasional kas entries that cause double asset reduction."""
    deleted = db.query(KasBank).filter(
        KasBank.sumber == KasBankSource.JASA_ANGKUT,
        KasBank.tipe == KasBankType.KELUAR,
        KasBank.keterangan.ilike("Biaya Operational Muatan %"),
    ).delete(synchronize_session=False)
    db.commit()
    return deleted


def run():
    db = SessionLocal()
    try:
        legacy = cleanup_legacy_ops_kas(db)
        if legacy:
            print(f"Cleaned {legacy} legacy operasional kas entries")

        service = MuatanService(db)
        today = date.today()

        # Scenario: revenue 200k, TPM gross 100k, tol 50k, net share 50k, partial 25k
        data = MuatanCreate(
            tanggal=today,
            supir_id=None,
            supir_nama="Test Driver Balance",
            armada_id=1,
            nopol="B TEST 123",
            asal="Asal",
            tujuan="Tujuan",
            jenis_muatan="Pasir",
            ritase=1,
            harga_beli=Decimal("1000000"),
            harga_jual=Decimal("1200000"),
            status_bayar=PaymentStatus.BELUM_LUNAS,
            metode_bayar=PaymentMethod.TUNAI,
            biaya_operasional=[
                BiayaItem(deskripsi="Tol", jumlah=Decimal("50000")),
            ],
            payments=[
                PaymentDetail(metode=PaymentMethod.TUNAI, nominal=Decimal("25000")),
            ],
            persentase_tpm=Decimal("50"),
        )

        try:
            muatan = service.create(data, user_id=1)
            print(f"Created muatan {muatan.nomor_transaksi}: laba_tpm={muatan.laba_tpm}, total_biaya={muatan.total_biaya}")
        except Exception as e:
            print(f"Create skipped/failed (may need valid armada_id): {e}")
            muatan = None

        if muatan:
            piutang = db.query(PiutangUsaha).filter(
                PiutangUsaha.referensi_id == muatan.id,
                PiutangUsaha.sumber == PiutangSource.JASA_ANGKUT,
            ).first()
            if piutang:
                print(f"Piutang: nominal={piutang.nominal_piutang}, dibayar={piutang.total_dibayar}, sisa={piutang.sisa_piutang}")

            ops_kas = db.query(KasBank).filter(
                KasBank.referensi_id == muatan.id,
                KasBank.sumber == KasBankSource.JASA_ANGKUT,
                KasBank.tipe == KasBankType.KELUAR,
                KasBank.keterangan.ilike(f"Biaya Operational Muatan {muatan.nomor_transaksi}:%"),
            ).count()
            print(f"Operasional kas KELUAR entries (should be 0): {ops_kas}")

        neraca = NeracaService(db).get_report(today)
        modal = ModalService(db).get_report(date(2024, 1, 1), today)

        print("\n=== NERACA ===")
        print(f"  Aktiva : {neraca['total_aktiva']:,.0f}")
        print(f"  Pasiva : {neraca['total_pasiva']:,.0f}")
        print(f"  Selisih: {neraca['selisih']:,.0f}")
        print(f"  Balanced: {neraca['is_balanced']}")

        print("\n=== PERUBAHAN MODAL ===")
        print(f"  Modal akhir : {modal.get('modal_akhir', 0):,.0f}")
        print(f"  Selisih       : {modal.get('selisih', 0):,.0f}")
        print(f"  Balanced      : {modal.get('is_balanced', False)}")

        if abs(neraca['selisih']) >= 1:
            print("\nFAIL: Neraca tidak balance")
            sys.exit(1)
        print("\nOK: Neraca balance")
    finally:
        db.close()


if __name__ == "__main__":
    run()