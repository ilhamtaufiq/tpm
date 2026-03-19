from datetime import datetime
from typing import Optional, Dict, Any

from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.supplier import Supplier
from app.schemas.master import SupplierCreate, SupplierUpdate
from app.utils.constants import TRANSACTION_PREFIXES


class SupplierService:
    """Service for supplier management."""

    def __init__(self, db: Session):
        self.db = db

    def _generate_kode(self) -> str:
        """Generate unique supplier code."""
        today = datetime.now()
        prefix = "SUP"
        date_str = today.strftime("%y%m")

        # Get last supplier with same prefix
        last = (
            self.db.query(Supplier)
            .filter(Supplier.kode.like(f"{prefix}{date_str}%"))
            .order_by(Supplier.id.desc())
            .first()
        )

        if last:
            last_num = int(last.kode[-4:])
            new_num = last_num + 1
        else:
            new_num = 1

        return f"{prefix}{date_str}{new_num:04d}"

    def create(self, data: SupplierCreate, user_id: Optional[int] = None) -> Supplier:
        """Create a new supplier."""
        # Check duplicate name
        existing = (
            self.db.query(Supplier)
            .filter(
                Supplier.nama == data.nama,
                Supplier.deleted_at.is_(None),
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Supplier dengan nama '{data.nama}' sudah ada",
            )

        # Generate kode if not provided
        kode = data.kode if data.kode else self._generate_kode()

        # Check duplicate kode
        existing_kode = (
            self.db.query(Supplier)
            .filter(Supplier.kode == kode)
            .first()
        )
        if existing_kode:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Kode supplier '{kode}' sudah digunakan",
            )

        supplier = Supplier(
            kode=kode,
            nama=data.nama,
            alamat=data.alamat,
            kota=data.kota,
            telepon=data.telepon,
            email=data.email,
            contact_person=data.contact_person,
            npwp=data.npwp,
            catatan=data.catatan,
        )

        self.db.add(supplier)
        self.db.commit()
        self.db.refresh(supplier)

        return supplier

    def get_by_id(self, supplier_id: int) -> Supplier:
        """Get supplier by ID."""
        supplier = (
            self.db.query(Supplier)
            .filter(
                Supplier.id == supplier_id,
                Supplier.deleted_at.is_(None),
            )
            .first()
        )
        if not supplier:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Supplier tidak ditemukan",
            )
        return supplier

    def get_by_kode(self, kode: str) -> Optional[Supplier]:
        """Get supplier by kode."""
        return (
            self.db.query(Supplier)
            .filter(
                Supplier.kode == kode,
                Supplier.deleted_at.is_(None),
            )
            .first()
        )

    def get_list(
        self,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        kota: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> Dict[str, Any]:
        """Get list of suppliers with pagination and filters."""
        query = self.db.query(Supplier).filter(Supplier.deleted_at.is_(None))

        # Search filter
        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                or_(
                    Supplier.nama.ilike(search_filter),
                    Supplier.kode.ilike(search_filter),
                    Supplier.telepon.ilike(search_filter),
                    Supplier.email.ilike(search_filter),
                )
            )

        # City filter
        if kota:
            query = query.filter(Supplier.kota == kota)

        # Count total
        total = query.count()

        # Sorting
        sort_column = getattr(Supplier, sort_by, Supplier.created_at)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        # Pagination
        suppliers = query.offset(skip).limit(limit).all()

        # Calculate pages
        pages = (total + limit - 1) // limit if limit > 0 else 1

        return {
            "data": suppliers,
            "total": total,
            "page": (skip // limit) + 1 if limit > 0 else 1,
            "size": limit,
            "pages": pages,
        }

    def update(self, supplier_id: int, data: SupplierUpdate) -> Supplier:
        """Update supplier."""
        supplier = self.get_by_id(supplier_id)

        update_data = data.model_dump(exclude_unset=True)

        # Check duplicate name if changing
        if "nama" in update_data and update_data["nama"] != supplier.nama:
            existing = (
                self.db.query(Supplier)
                .filter(
                    Supplier.nama == update_data["nama"],
                    Supplier.id != supplier_id,
                    Supplier.deleted_at.is_(None),
                )
                .first()
            )
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Supplier dengan nama '{update_data['nama']}' sudah ada",
                )

        for field, value in update_data.items():
            setattr(supplier, field, value)

        self.db.commit()
        self.db.refresh(supplier)

        return supplier

    def delete(self, supplier_id: int) -> bool:
        """Soft delete supplier."""
        supplier = self.get_by_id(supplier_id)

        # Check if has related pembelian
        if supplier.pembelian.count() > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat menghapus supplier yang memiliki riwayat pembelian",
            )

        supplier.deleted_at = datetime.now()
        self.db.commit()

        return True

    def search(self, query: Optional[str], limit: int = 10) -> list[Supplier]:
        """Search suppliers for autocomplete."""
        db_query = self.db.query(Supplier).filter(Supplier.deleted_at.is_(None))

        if query:
            search_filter = f"%{query}%"
            db_query = db_query.filter(
                or_(
                    Supplier.nama.ilike(search_filter),
                    Supplier.kode.ilike(search_filter),
                )
            )
        else:
            # If no query, return latest suppliers
            db_query = db_query.order_by(Supplier.id.desc())

        return db_query.limit(limit).all()

    def get_cities(self) -> list[str]:
        """Get distinct cities from suppliers."""
        cities = (
            self.db.query(Supplier.kota)
            .filter(
                Supplier.deleted_at.is_(None),
                Supplier.kota.isnot(None),
            )
            .distinct()
            .all()
        )
        return [c[0] for c in cities if c[0]]
