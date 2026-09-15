"""
Regresi untuk `_resolve_kas_jenis`: TRANSFER tidak boleh mendarat di akun kas.

Bug asal (kas_bank id=93 / KAS2609150042): pengeluaran TRANSFER dicatat ke
KAS_UTAMA karena `kas_jenis` dari request menimpa policy, sehingga kas tunai
turun 3.000.000 sementara bank tidak pernah terpotong.
"""
from app.services.kas_bank_integration import _resolve_kas_jenis, get_kas_jenis
from app.utils.constants import KasBankJenis, KasBankSource, PaymentMethod


def test_transfer_ke_akun_kas_dipaksa_ke_bank():
    hasil = _resolve_kas_jenis(
        KasBankJenis.KAS_UTAMA, PaymentMethod.TRANSFER, KasBankSource.PENGELUARAN
    )
    assert hasil == KasBankJenis.BANK_UTAMA


def test_transfer_ke_dompet_unit_dipaksa_ke_bank():
    for akun in (
        KasBankJenis.KAS_UNIT_BENGKEL,
        KasBankJenis.KAS_UNIT_JASA_ANGKUT,
        KasBankJenis.KAS_UNIT_MOBIL,
        KasBankJenis.CASH,
    ):
        assert _resolve_kas_jenis(
            akun, PaymentMethod.TRANSFER, KasBankSource.BENGKEL
        ) == KasBankJenis.BANK_UTAMA


def test_tanpa_kas_jenis_mengikuti_policy():
    assert _resolve_kas_jenis(
        None, PaymentMethod.TRANSFER, KasBankSource.PENGELUARAN
    ) == KasBankJenis.BANK_UTAMA
    assert _resolve_kas_jenis(
        None, PaymentMethod.TUNAI, KasBankSource.BENGKEL
    ) == KasBankJenis.KAS_UNIT_BENGKEL


def test_pilihan_akun_yang_konsisten_tetap_dihormati():
    # Penarikan investor: TUNAI dari dompet unit, bukan default unit mobil.
    assert _resolve_kas_jenis(
        KasBankJenis.KAS_UNIT_BENGKEL, PaymentMethod.TUNAI, KasBankSource.HUTANG
    ) == KasBankJenis.KAS_UNIT_BENGKEL
    # Transfer ke bank eksplisit juga lolos.
    assert _resolve_kas_jenis(
        KasBankJenis.BANK_UTAMA, PaymentMethod.TRANSFER, KasBankSource.HUTANG
    ) == KasBankJenis.BANK_UTAMA


def test_tunai_ke_bank_dibiarkan_tapi_bukan_policy():
    # Arah sebaliknya tidak menggeser uang antar unit; dibiarkan.
    assert _resolve_kas_jenis(
        KasBankJenis.BANK_UTAMA, PaymentMethod.TUNAI, KasBankSource.LAINNYA
    ) == KasBankJenis.BANK_UTAMA
    assert get_kas_jenis(
        PaymentMethod.TUNAI, KasBankSource.LAINNYA
    ) == KasBankJenis.KAS_UTAMA
