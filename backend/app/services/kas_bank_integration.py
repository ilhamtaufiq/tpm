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


def get_kas_jenis(metode_bayar: PaymentMethod, sumber: Optional[KasBankSource] = None) -> KasBankJenis:
    """Map payment method and source to kas/bank account type.

    Args:
        metode_bayar: The payment method used
        sumber: The transaction source (e.g. BENGKEL, JASA_ANGKUT)

    Returns:
        KasBankJenis indicating which account to use
    """
    # Ensure it's the Enum member for comparison
    try:
        method = PaymentMethod(metode_bayar)
    except (ValueError, TypeError):
        method = PaymentMethod.TUNAI

    # Transfer always goes to Bank Utama (BCA)
    if method == PaymentMethod.TRANSFER:
        return KasBankJenis.BANK_BCA

    # Cash mapping based on business unit
    if sumber == KasBankSource.BENGKEL:
        return KasBankJenis.KAS_UNIT_BENGKEL
    elif sumber == KasBankSource.JASA_ANGKUT:
        return KasBankJenis.KAS_UNIT_JASA_ANGKUT
    elif sumber == KasBankSource.JUAL_BELI_MOBIL:
        return KasBankJenis.KAS_UNIT_MOBIL

    # Default to Main Cash for non-unit specific or legacy entries
    return KasBankJenis.KAS_UTAMA


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
    """
    service = KasBankService(db)

    # Use explicit kas_jenis if provided, otherwise map from payment method and source
    selected_jenis = kas_jenis if kas_jenis else get_kas_jenis(metode_bayar, sumber)

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
