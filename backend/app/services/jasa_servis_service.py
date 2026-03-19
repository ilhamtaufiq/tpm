from datetime import datetime
from typing import Optional, Dict, Any, List

from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.bengkel import JasaServis
from app.schemas.bengkel import JasaServisCreate, JasaServisUpdate


class JasaServisService:
    """Service for workshop service master data management."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, data: JasaServisCreate) -> JasaServis:
        """Create a new workshop service."""
        # Check duplicate name
        existing = (
            self.db.query(JasaServis)
            .filter(
                JasaServis.nama == data.nama,
                JasaServis.deleted_at.is_(None),
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Jasa servis dengan nama '{data.nama}' sudah ada",
            )

        jasa_servis = JasaServis(
            nama=data.nama,
            kategori=data.kategori,
            harga=data.harga,
            deskripsi=data.deskripsi,
        )

        self.db.add(jasa_servis)
        self.db.commit()
        self.db.refresh(jasa_servis)

        return jasa_servis

    def get_by_id(self, jasa_id: int) -> JasaServis:
        """Get workshop service by ID."""
        jasa = (
            self.db.query(JasaServis)
            .filter(
                JasaServis.id == jasa_id,
                JasaServis.deleted_at.is_(None),
            )
            .first()
        )
        if not jasa:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Jasa servis tidak ditemukan",
            )
        return jasa

    def get_list(
        self,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        kategori: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get list of workshop services with pagination and filters."""
        query = self.db.query(JasaServis).filter(JasaServis.deleted_at.is_(None))

        if search:
            query = query.filter(JasaServis.nama.ilike(f"%{search}%"))

        if kategori:
            query = query.filter(JasaServis.kategori == kategori)

        total = query.count()
        jasa_list = query.order_by(JasaServis.nama.asc()).offset(skip).limit(limit).all()
        pages = (total + limit - 1) // limit if limit > 0 else 1

        return {
            "data": jasa_list,
            "total": total,
            "page": (skip // limit) + 1 if limit > 0 else 1,
            "size": limit,
            "pages": pages,
        }

    def update(self, jasa_id: int, data: JasaServisUpdate) -> JasaServis:
        """Update workshop service."""
        jasa = self.get_by_id(jasa_id)
        update_data = data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(jasa, field, value)

        self.db.commit()
        self.db.refresh(jasa)
        return jasa

    def delete(self, jasa_id: int) -> bool:
        """Soft delete workshop service."""
        jasa = self.get_by_id(jasa_id)
        jasa.deleted_at = datetime.now()
        self.db.commit()
        return True
