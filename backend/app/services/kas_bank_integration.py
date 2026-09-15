"""
Helper functions for KasBank integration.

This module provides utilities for automatically recording financial transactions
to the kas_bank ledger when transactions occur in other parts of the system.
"""

import logging
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.models.keuangan import KasBank
from app.schemas.keuangan import KasBankCreate
from app.services.kas_bank_service import KasBankService
from app.realtime import publish_realtime_event
from app.utils.constants import (
    KasBankType,
    KasBankSource,
    KasBankJenis,
    PaymentMethod,
)

logger = logging.getLogger(__name__)

# Akun kas tunai vs akun bank. TRANSFER yang mendarat di akun kas adalah defect
# nyata: uang bank tercatat mengurangi kas tunai, dan saldo satu akun jadi salah.
_AKUN_BANK = frozenset({KasBankJenis.BANK_UTAMA})
_AKUN_KAS = frozenset({
    KasBankJenis.CASH,
    KasBankJenis.KAS_UTAMA,
    KasBankJenis.KAS_UNIT_BENGKEL,
    KasBankJenis.KAS_UNIT_JASA_ANGKUT,
    KasBankJenis.KAS_UNIT_MOBIL,
})


def _resolve_kas_jenis(
    kas_jenis: Optional[KasBankJenis],
    metode_bayar: PaymentMethod,
    sumber: Optional[KasBankSource],
) -> KasBankJenis:
    """Pilih akun final, tolak `kas_jenis` yang menempatkan TRANSFER di akun kas.

    Pemanggil boleh memilih akun lain selama tidak bertentangan (`kas_jenis`
    dipakai untuk konteks yang tidak diketahui policy, mis. penarikan investor
    yang selalu dividen dari dompet unit). Satu arah saja yang diblokir:
    TRANSFER ke akun kas. Arah sebaliknya (TUNAI ke bank) tidak menggeser uang
    antar unit, jadi dibiarkan tapi diperingatkan karena labelnya menyesatkan.
    """
    if kas_jenis is None:
        return get_kas_jenis(metode_bayar, sumber)

    try:
        bank_method = PaymentMethod(metode_bayar) == PaymentMethod.TRANSFER
    except (ValueError, TypeError):
        bank_method = False

    if bank_method and kas_jenis in _AKUN_KAS:
        expected = get_kas_jenis(metode_bayar, sumber)
        logger.warning(
            "kas_jenis=%s tidak konsisten dengan metode_bayar=%s (sumber=%s); dipakai %s",
            kas_jenis, metode_bayar, sumber, expected,
        )
        return expected

    if not bank_method and kas_jenis in _AKUN_BANK:
        logger.warning(
            "kas_jenis=%s (akun bank) dengan metode_bayar=%s (sumber=%s)",
            kas_jenis, metode_bayar, sumber,
        )

    return kas_jenis


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

    # POLICY: Unit-specific isolation.
    # - TRANSFER flows directly to the Main Bank account (Akun Utama).
    # - TUNAI uses the unit drawer (physical cash).
    # - INTERNAL is bookkeeping-only for inter-unit debt; it must not move unit wallets.
    if method == PaymentMethod.TRANSFER:
        return KasBankJenis.BANK_UTAMA
    
    # Map based on business unit for Tunai and Internal (Bookkeeping) movements
    if sumber == KasBankSource.BENGKEL:
        return KasBankJenis.KAS_UNIT_BENGKEL
    elif sumber == KasBankSource.JASA_ANGKUT:
        return KasBankJenis.KAS_UNIT_JASA_ANGKUT
    elif sumber == KasBankSource.JUAL_BELI_MOBIL:
        return KasBankJenis.KAS_UNIT_MOBIL

    # Default to Main Cash for non-unit specific or central internal entries
    return KasBankJenis.KAS_UTAMA


def _scope_for_kas_jenis(jenis: KasBankJenis) -> str:
    if jenis == KasBankJenis.KAS_UNIT_BENGKEL:
        return "bengkel"
    if jenis == KasBankJenis.KAS_UNIT_JASA_ANGKUT:
        return "jasa_angkut"
    if jenis == KasBankJenis.KAS_UNIT_MOBIL:
        return "mobil"
    return "finance"


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
    allow_negative: bool = False,
    commit: bool = True,
) -> KasBank:
    """Create a kas/bank entry for financial transactions.
    
    This function automatically records financial transactions to the kas_bank
    ledger, ensuring all money movements are tracked through the cash/bank system.
    """
    service = KasBankService(db)

    # Use explicit kas_jenis if provided and consistent, otherwise derive from policy
    selected_jenis = _resolve_kas_jenis(kas_jenis, metode_bayar, sumber)

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
        allow_negative=allow_negative,
    )

    kas_bank = service.create(data, user_id, commit=commit)
    if commit:
        publish_realtime_event(
            event="finance.kas.updated",
            scope=_scope_for_kas_jenis(selected_jenis),
            entity="kas_bank",
            action="created",
            entity_id=kas_bank.id,
            data={
                "nomor_transaksi": kas_bank.nomor_transaksi,
                "jenis": kas_bank.jenis.value if hasattr(kas_bank.jenis, "value") else str(kas_bank.jenis),
                "tipe": kas_bank.tipe.value if hasattr(kas_bank.tipe, "value") else str(kas_bank.tipe),
            },
        )
    return kas_bank

