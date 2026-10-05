from datetime import date
from typing import Annotated, Optional

from pydantic import AfterValidator

from app.utils.helpers import validasi_tanggal_transaksi

# Tanggal input transaksi: tidak boleh melewati hari ini (WIB).
TanggalTransaksi = Annotated[date, AfterValidator(validasi_tanggal_transaksi)]
OptionalTanggalTransaksi = Annotated[Optional[date], AfterValidator(validasi_tanggal_transaksi)]
