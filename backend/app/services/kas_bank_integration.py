"""
Helper functions for KasBank integration.

This module provides utilities for automatically recording financial transactions
to the kas_bank ledger when transactions occur in other parts of the system.
"""

from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.models.keuangan import KasBank
from app.schemas.keuangan import KasBankCreate
from app.services.kas_bank_service import KasBankService
from app.utils.constants import (
    KasBankType,
    KasBankSource,
    KasBankJenis,
    PaymentMethod,
)


def get_kas_jenis(metode_bayar: PaymentMethod) -> KasBankJenis:
    """Map payment method to kas/bank account type.

    Args:
        metode_bayar: The payment method used

    Returns:
        KasBankJenis indicating which account to use
    """
    # Ensure it's the Enum member for comparison (handles case-insensitive strings)
    try:
        method = PaymentMethod(metode_bayar)
    except (ValueError, TypeError):
        method = PaymentMethod.TUNAI

    if method == PaymentMethod.TRANSFER:
        return KasBankJenis.BANK_BCA
    return KasBankJenis.CASH


def create_kas_entry(
    db: Session,
    tanggal: date,
    tipe: KasBankType,
    nominal: Decimal,
    sumber: KasBankSource,
    metode_bayar: PaymentMethod,
    referensi_id: Optional[int],
    nomor_referensi: str,
    keterangan: str,
    user_id: Optional[int] = None,
    kas_jenis: Optional[KasBankJenis] = None,
) -> KasBank:
    """Create a kas/bank entry for financial transactions.

    This function automatically records financial transactions to the kas_bank
    ledger, ensuring all money movements are tracked through the cash/bank system.

    Args:
        db: Database session
        tanggal: Transaction date
        tipe: Transaction type (MASUK for incoming, KELUAR for outgoing)
        nominal: Transaction amount (must be positive)
        sumber: Source of the transaction (BENGKEL, GAJI, KASBON, etc.)
        metode_bayar: Payment method (TUNAI or TRANSFER)
        referensi_id: ID of the source transaction (optional)
        nomor_referensi: Reference number of the source transaction
        keterangan: Description of the transaction
        user_id: ID of the user creating the transaction (optional)
        kas_jenis: Explicit account type to use (overrides mapping from metode_bayar)

    Returns:
        The created KasBank record
    """
    service = KasBankService(db)

    # Use explicit kas_jenis if provided, otherwise map from payment method
    selected_jenis = kas_jenis if kas_jenis else get_kas_jenis(metode_bayar)

    data = KasBankCreate(
        tanggal=tanggal,
        jenis=selected_jenis,
        tipe=tipe,
        nominal=nominal,
        sumber=sumber,
        metode_bayar=metode_bayar,
        referensi_id=referensi_id,
        nomor_referensi=nomor_referensi,
        keterangan=keterangan,
    )

    return service.create(data, user_id)
