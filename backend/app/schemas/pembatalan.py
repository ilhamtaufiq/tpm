from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict


class PembatalanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    jenis: str
    nomor_dokumen: str
    dokumen_id: Optional[int] = None
    ringkasan: str
    nominal: Decimal
    alasan: str
    kas_nomor: Optional[str] = None
    dibatalkan_at: datetime
    dibatalkan_by: Optional[int] = None
