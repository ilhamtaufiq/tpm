"""Sembunyikan baris yang sudah dibatalkan dari semua SELECT ORM.

Pembatalan tidak menghapus baris (jurnal tidak boleh DELETE, lihat invariant 3).
Jurnal asli dan jurnal balik sama-sama diberi `dibatalkan_at`, sehingga laporan,
saldo, dan ringkasan menghitung seolah transaksi itu tidak pernah ada. Filter ini
ditanam sekali di sini, bukan di setiap query. Pemanggil
yang memang perlu baris batal (detail riwayat, layanan pembatalan) memakai
`execution_options(include_dibatalkan=True)`.
"""

from sqlalchemy import event
from sqlalchemy.orm import Session, with_loader_criteria

from app.models.bengkel import PengeluaranBengkel
from app.models.keuangan import KasBank
from app.models.jasa_angkut import JasaAngkutPartService
from app.models.mobil import MobilPartService

INCLUDE_DIBATALKAN = "include_dibatalkan"

MODEL_DIBATALKAN = (PengeluaranBengkel, JasaAngkutPartService, MobilPartService, KasBank)


@event.listens_for(Session, "do_orm_execute")
def _sembunyikan_dibatalkan(state):
    if not state.is_select or state.execution_options.get(INCLUDE_DIBATALKAN, False):
        return
    state.statement = state.statement.options(
        *(
            with_loader_criteria(
                model,
                lambda cls: cls.dibatalkan_at.is_(None),
                include_aliases=True,
            )
            for model in MODEL_DIBATALKAN
        )
    )
