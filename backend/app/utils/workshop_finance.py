"""Shared filters for workshop transactions in financial reports."""

from app.models.bengkel import TransaksiPenjualanBengkel
from app.utils.constants import PaymentStatus, WorkshopStatus

INTERNAL_MOBIL_KATEGORI = ("jual_beli_mobil", "mobil", "penjualan_mobil")


def workshop_finance_recognized_filters():
    """
    Workshop orders recognized in P&L, Neraca, and Perubahan Modal.

    Per FINANCE_REPORTING_GUARDRAIL: grand_total > 0 counts even when
    status_pengerjaan is still ANTRE/PROSES; only BATAL is excluded.
    """
    return (
        TransaksiPenjualanBengkel.grand_total > 0,
        TransaksiPenjualanBengkel.status_bayar != PaymentStatus.BATAL,
        TransaksiPenjualanBengkel.status_pengerjaan != WorkshopStatus.BATAL,
    )


def internal_mobil_workshop_filters():
    """Internal JB Mobil workshop bills capitalized into car inventory."""
    return (
        *workshop_finance_recognized_filters(),
        TransaksiPenjualanBengkel.kategori.in_(INTERNAL_MOBIL_KATEGORI),
    )