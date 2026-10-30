"""Label metode pembayaran di struk harus sama dengan metode yang tercatat.
TRANSFER hanya TRANSFER (bukan QRIS), dan KREDIT adalah bon, bukan kartu kredit.
"""
import pytest

from app.api.v1.public_receipt import format_payment_method
from app.utils.constants import PaymentMethod


@pytest.mark.parametrize("metode, label", [
    ("TRANSFER", "TRANSFER"),
    ("TUNAI", "TUNAI"),
    ("KREDIT", "BON / PIUTANG"),
    ("PIUTANG", "BON / PIUTANG"),
    ("DEBIT", "KARTU DEBIT"),
    ("SPLIT", "GABUNGAN"),
])
def test_label_sesuai_metode(metode, label):
    assert format_payment_method(metode) == label


def test_enum_dengan_awalan_tetap_terbaca():
    assert format_payment_method(PaymentMethod.TRANSFER) == "TRANSFER"
    assert format_payment_method("PaymentMethod.KREDIT") == "BON / PIUTANG"


def test_tidak_ada_label_kartu_kredit_atau_qris():
    for metode in ("TRANSFER", "KREDIT", "TUNAI", "DEBIT", "SPLIT", "PIUTANG"):
        label = format_payment_method(metode)
        assert "QRIS" not in label
        assert "KARTU KREDIT" not in label
