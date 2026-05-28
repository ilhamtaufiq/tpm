from datetime import date
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.keuangan import Aset
from app.schemas.keuangan import AssetCreate, AssetUpdate
from app.utils.constants import AssetStatus, TRANSACTION_PREFIXES


class AssetService:
    """Service for managing fixed assets (Aset)."""

    def __init__(self, db: Session):
        self.db = db

    def _generate_kode(self) -> str:
        """Generate unique asset code AST-YYYYMM-XXXX."""
        prefix = TRANSACTION_PREFIXES.get("aset", "AST")
        today = date.today()
        date_str = today.strftime("%Y%m")
        
        # Get last asset with the same date prefix
        last = (
            self.db.query(Aset)
            .filter(Aset.kode.like(f"{prefix}-{date_str}-%"))
            .order_by(Aset.id.desc())
            .first()
        )
        
        if last:
            try:
                last_num = int(last.kode.split("-")[-1])
                new_num = last_num + 1
            except (ValueError, IndexError):
                new_num = 1
        else:
            new_num = 1
            
        return f"{prefix}-{date_str}-{new_num:04d}"

    def create(self, obj_in: AssetCreate, user_id: int) -> Aset:
        """Create a new asset."""
        db_obj = Aset(
            **obj_in.model_dump(),
            kode=self._generate_kode(),
            created_by=user_id,
        )
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    def get(self, id: int) -> Optional[Aset]:
        """Get asset by ID."""
        return self.db.query(Aset).filter(Aset.id == id).first()

    def get_list(
        self,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        kategori: Optional[str] = None,
        status: Optional[AssetStatus] = None,
    ) -> dict:
        """Get list of assets with filters."""
        query = self.db.query(Aset)

        if search:
            query = query.filter(
                or_(
                    Aset.nama.ilike(f"%{search}%"),
                    Aset.kode.ilike(f"%{search}%"),
                    Aset.lokasi.ilike(f"%{search}%"),
                )
            )

        if kategori and kategori != "all":
            query = query.filter(Aset.kategori == kategori)

        if status:
            query = query.filter(Aset.status == status)

        total = query.count()
        data = query.order_by(Aset.created_at.desc()).offset(skip).limit(limit).all()
        
        # Calculate total value
        total_value = self.db.query(func.sum(Aset.harga_beli)).filter(Aset.status == AssetStatus.AKTIF).scalar() or 0

        return {
            "data": data,
            "total": total,
            "total_value": Decimal(total_value),
        }

    def update(self, id: int, obj_in: AssetUpdate) -> Optional[Aset]:
        """Update an asset."""
        db_obj = self.get(id)
        if not db_obj:
            return None

        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)

        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    def delete(self, id: int) -> bool:
        """Delete an asset."""
        db_obj = self.get(id)
        if not db_obj:
            return False

        self.db.delete(db_obj)
        self.db.commit()
        return True

    def get_summary(self) -> dict:
        """Get summary of assets for dashboard/reports."""
        total_value = self.db.query(func.sum(Aset.harga_beli)).filter(Aset.status == AssetStatus.AKTIF).scalar() or 0
        count_by_kategori = (
            self.db.query(Aset.kategori, func.count(Aset.id))
            .group_by(Aset.kategori)
            .all()
        )
        
        # The following print statement refers to variables not defined in this context.
        # Assuming these are placeholders for future calculations or belong to a different service.
        # For now, they are commented out to maintain syntactical correctness.
        # print(f"DEBUG NERACA AKTIVA: Kas={total_kas_bank}, Piutang={total_piutang}, Persediaan={persediaan_sparepart}, Mobil={stok_mobil_total}")
        
        return {
            "total_value": Decimal(total_value),
            "by_kategori": {str(k.value): v for k, v in count_by_kategori},
        }
