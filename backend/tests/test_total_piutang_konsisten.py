"""Total per nama (grup) dan total per struk (summary layar) harus sama."""
from decimal import Decimal

from app.services.nama_grup_service import NamaGrupService
from app.services.piutang_service import PiutangService
from app.utils.constants import KasBankJenis, PaymentMethod, PiutangSource
from app.schemas.keuangan import PiutangCreate
from app.utils.helpers import get_jakarta_date
from tests.test_pembatalan_keuangan import _buat_kasbon, _seed, db  # noqa: F401  (fixture)


def test_total_per_nama_sama_dengan_total_per_struk(db):  # noqa: F811
    _seed(db, KasBankJenis.KAS_UTAMA, "1000000")
    _buat_kasbon(db, nominal="200000")
    _buat_kasbon(db, nominal="150000")
    PiutangService(db).create(
        PiutangCreate(
            tanggal=get_jakarta_date(),
            sumber=PiutangSource.LAINNYA,
            nama_debitur="Siti Test",
            nominal_piutang=Decimal("100000"),
            metode_pembayaran=PaymentMethod.TUNAI,
        ),
        None,
    )

    grup_total = sum(g["total_sisa"] for g in NamaGrupService(db).piutang_grup())
    summary_total = PiutangService(db).get_summary(exclude_internal=True)["total_sisa"]

    assert abs(grup_total - summary_total) < 1
    assert grup_total >= 450000 - 1
