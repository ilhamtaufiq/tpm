from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi import HTTPException, status

from app.models.jasa_angkut import ArmadaJasaAngkut, MuatanJasaAngkut
from app.schemas.jasa_angkut import ArmadaCreate, ArmadaUpdate

class ArmadaService:
    """Service for armada management."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, data: ArmadaCreate) -> ArmadaJasaAngkut:
        """Create a new armada."""
        existing = self.db.query(ArmadaJasaAngkut).filter(
            ArmadaJasaAngkut.nopol == data.nopol,
            ArmadaJasaAngkut.deleted_at.is_(None)
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Armada dengan nopol '{data.nopol}' sudah ada",
            )

        armada = ArmadaJasaAngkut(**data.model_dump())
        self.db.add(armada)
        self.db.commit()
        self.db.refresh(armada)
        return armada

    def get_by_id(self, armada_id: int) -> ArmadaJasaAngkut:
        """Get armada by ID."""
        armada = self.db.query(ArmadaJasaAngkut).filter(
            ArmadaJasaAngkut.id == armada_id,
            ArmadaJasaAngkut.deleted_at.is_(None)
        ).first()
        if not armada:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Armada tidak ditemukan",
            )
        return armada

    def get_list(
        self,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """Get list of armada with pagination and filters."""
        query = self.db.query(ArmadaJasaAngkut).filter(ArmadaJasaAngkut.deleted_at.is_(None))

        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                or_(
                    ArmadaJasaAngkut.nama.ilike(search_filter),
                    ArmadaJasaAngkut.nopol.ilike(search_filter),
                )
            )

        if is_active is not None:
            query = query.filter(ArmadaJasaAngkut.is_active == is_active)

        total = query.count()
        armadas = query.order_by(ArmadaJasaAngkut.nama.asc()).offset(skip).limit(limit).all()
        pages = (total + limit - 1) // limit if limit > 0 else 1

        return {
            "data": armadas,
            "total": total,
            "page": (skip // limit) + 1 if limit > 0 else 1,
            "size": limit,
            "pages": pages,
        }

    def update(self, armada_id: int, data: ArmadaUpdate) -> ArmadaJasaAngkut:
        """Update armada information."""
        armada = self.get_by_id(armada_id)
        update_data = data.model_dump(exclude_unset=True)

        if "nopol" in update_data and update_data["nopol"] != armada.nopol:
            existing = self.db.query(ArmadaJasaAngkut).filter(
                ArmadaJasaAngkut.nopol == update_data["nopol"],
                ArmadaJasaAngkut.id != armada_id,
                ArmadaJasaAngkut.deleted_at.is_(None)
            ).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Armada dengan nopol '{update_data['nopol']}' sudah ada",
                )

        for field, value in update_data.items():
            setattr(armada, field, value)

        self.db.commit()
        self.db.refresh(armada)
        return armada

    def delete(self, armada_id: int) -> bool:
        """Soft delete armada."""
        armada = self.get_by_id(armada_id)

        # Check if has trips
        has_trips = self.db.query(MuatanJasaAngkut).filter(
            MuatanJasaAngkut.armada_id == armada_id
        ).first()
        if has_trips:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat menghapus armada yang memiliki riwayat transaksi",
            )

        from datetime import datetime
        armada.deleted_at = datetime.utcnow()
        self.db.commit()
        return True

    def get_active_armada(self) -> List[ArmadaJasaAngkut]:
        """Get all active armada for dropdown."""
        return self.db.query(ArmadaJasaAngkut).filter(
            ArmadaJasaAngkut.deleted_at.is_(None),
            ArmadaJasaAngkut.is_active == True
        ).order_by(ArmadaJasaAngkut.nama.asc()).all()
