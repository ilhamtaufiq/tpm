from datetime import datetime
from decimal import Decimal
from typing import Optional, Dict, Any, List

from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
import io
import openpyxl

from app.models.bengkel import SparePart
from app.schemas.bengkel import SparePartCreate, SparePartUpdate


class SparePartService:
    """Service for spare part inventory management."""

    def __init__(self, db: Session):
        self.db = db

    def generate_next_kode(self) -> str:
        """Generate unique spare part code."""
        today = datetime.now()
        prefix = "SPR"
        date_str = today.strftime("%y%m")

        last = (
            self.db.query(SparePart)
            .filter(SparePart.kode.like(f"{prefix}{date_str}%"))
            .order_by(SparePart.id.desc())
            .first()
        )

        if last:
            last_num = int(last.kode[-4:])
            new_num = last_num + 1
        else:
            new_num = 1

        return f"{prefix}{date_str}{new_num:04d}"

    def create(self, data: SparePartCreate, user_id: Optional[int] = None) -> SparePart:
        """Create a new spare part."""
        # Check duplicate name
        existing = (
            self.db.query(SparePart)
            .filter(
                SparePart.nama == data.nama,
                SparePart.deleted_at.is_(None),
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Spare part dengan nama '{data.nama}' sudah ada",
            )

        # Generate kode if not provided
        kode = data.kode if data.kode else self.generate_next_kode()

        # Check duplicate kode
        existing_kode = self.db.query(SparePart).filter(SparePart.kode == kode).first()
        if existing_kode:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Kode spare part '{kode}' sudah digunakan",
            )

        spare_part = SparePart(
            kode=kode,
            nama=data.nama,
            kode_part=data.kode_part,
            kategori=data.kategori,
            merek=data.merek,
            satuan=data.satuan,
            stok=data.stok,
            stok_minimum=data.stok_minimum,
            harga_beli=data.harga_beli,
            harga_jual=data.harga_jual,
            lokasi_rak=data.lokasi_rak,
            catatan=data.catatan,
        )

        self.db.add(spare_part)
        self.db.commit()
        self.db.refresh(spare_part)

        return spare_part

    def get_by_id(self, spare_part_id: int) -> SparePart:
        """Get spare part by ID."""
        spare_part = (
            self.db.query(SparePart)
            .filter(
                SparePart.id == spare_part_id,
                SparePart.deleted_at.is_(None),
            )
            .first()
        )
        if not spare_part:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Spare part tidak ditemukan",
            )
        return spare_part

    def get_by_kode(self, kode: str) -> Optional[SparePart]:
        """Get spare part by kode."""
        return (
            self.db.query(SparePart)
            .filter(
                SparePart.kode == kode,
                SparePart.deleted_at.is_(None),
            )
            .first()
        )

    def get_list(
        self,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        kategori: Optional[str] = None,
        merek: Optional[str] = None,
        low_stock_only: bool = False,
        sort_by: str = "nama",
        sort_order: str = "asc",
    ) -> Dict[str, Any]:
        """Get list of spare parts with pagination and filters."""
        query = self.db.query(SparePart).filter(SparePart.deleted_at.is_(None))

        # Search filter
        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                or_(
                    SparePart.nama.ilike(search_filter),
                    SparePart.kode.ilike(search_filter),
                    SparePart.kode_part.ilike(search_filter),
                    SparePart.merek.ilike(search_filter),
                )
            )

        # Category filter
        if kategori:
            query = query.filter(SparePart.kategori == kategori)

        # Brand filter
        if merek:
            query = query.filter(SparePart.merek == merek)

        # Low stock filter
        if low_stock_only:
            query = query.filter(SparePart.stok <= SparePart.stok_minimum)

        # Count total
        total = query.count()

        # Sorting
        sort_column = getattr(SparePart, sort_by, SparePart.nama)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        # Pagination
        spare_parts = query.offset(skip).limit(limit).all()

        # Calculate pages
        pages = (total + limit - 1) // limit if limit > 0 else 1

        return {
            "data": spare_parts,
            "total": total,
            "page": (skip // limit) + 1 if limit > 0 else 1,
            "size": limit,
            "pages": pages,
        }

    def update(self, spare_part_id: int, data: SparePartUpdate) -> SparePart:
        """Update spare part."""
        spare_part = self.get_by_id(spare_part_id)

        update_data = data.model_dump(exclude_unset=True)

        # Check duplicate name if changing
        if "nama" in update_data and update_data["nama"] != spare_part.nama:
            existing = (
                self.db.query(SparePart)
                .filter(
                    SparePart.nama == update_data["nama"],
                    SparePart.id != spare_part_id,
                    SparePart.deleted_at.is_(None),
                )
                .first()
            )
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Spare part dengan nama '{update_data['nama']}' sudah ada",
                )

        for field, value in update_data.items():
            setattr(spare_part, field, value)

        self.db.commit()
        self.db.refresh(spare_part)

        return spare_part

    def delete(self, spare_part_id: int) -> bool:
        """Soft delete spare part."""
        spare_part = self.get_by_id(spare_part_id)

        # Check if has stock
        if spare_part.stok > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat menghapus spare part yang masih memiliki stok",
            )

        spare_part.deleted_at = datetime.now()
        self.db.commit()

        return True

    def update_stock(
        self,
        spare_part_id: int,
        quantity: int,
        operation: str = "add",
    ) -> SparePart:
        """Update spare part stock.

        Args:
            spare_part_id: ID of spare part
            quantity: Amount to add/subtract
            operation: 'add' or 'subtract'
        """
        spare_part = self.get_by_id(spare_part_id)

        if operation == "add":
            spare_part.stok += quantity
        elif operation == "subtract":
            if spare_part.stok < quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Stok tidak mencukupi. Stok tersedia: {spare_part.stok}",
                )
            spare_part.stok -= quantity
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Operation harus 'add' atau 'subtract'",
            )

        self.db.commit()
        self.db.refresh(spare_part)

        return spare_part

    def update_price(
        self,
        spare_part_id: int,
        harga_beli: Optional[Decimal] = None,
        harga_jual: Optional[Decimal] = None,
    ) -> SparePart:
        """Update spare part prices."""
        spare_part = self.get_by_id(spare_part_id)

        if harga_beli is not None:
            spare_part.harga_beli = harga_beli
        if harga_jual is not None:
            spare_part.harga_jual = harga_jual

        self.db.commit()
        self.db.refresh(spare_part)

        return spare_part

    def get_low_stock_items(self) -> List[SparePart]:
        """Get spare parts with low stock."""
        return (
            self.db.query(SparePart)
            .filter(
                SparePart.deleted_at.is_(None),
                SparePart.stok <= SparePart.stok_minimum,
            )
            .order_by(SparePart.stok.asc())
            .all()
        )

    def get_stock_value(self) -> Dict[str, Any]:
        """Get total stock value."""
        result = (
            self.db.query(
                func.sum(SparePart.stok * SparePart.harga_beli).label("total_value"),
                func.sum(SparePart.stok).label("total_items"),
                func.count(SparePart.id).label("total_products"),
            )
            .filter(SparePart.deleted_at.is_(None))
            .first()
        )

        return {
            "total_value": float(result.total_value or 0),
            "total_items": result.total_items or 0,
            "total_products": result.total_products or 0,
        }

    def search_for_transaction(
        self,
        query: str,
        limit: int = 20,
    ) -> List[SparePart]:
        """Search spare parts for transaction form."""
        search_filter = f"%{query}%"
        return (
            self.db.query(SparePart)
            .filter(
                SparePart.deleted_at.is_(None),
                SparePart.stok > 0,
                or_(
                    SparePart.nama.ilike(search_filter),
                    SparePart.kode.ilike(search_filter),
                    SparePart.kode_part.ilike(search_filter),
                ),
            )
            .order_by(SparePart.nama.asc())
            .limit(limit)
            .all()
        )

    def get_categories(self) -> List[str]:
        """Get distinct categories."""
        categories = (
            self.db.query(SparePart.kategori)
            .filter(
                SparePart.deleted_at.is_(None),
                SparePart.kategori.isnot(None),
            )
            .distinct()
            .all()
        )
        return [c[0] for c in categories if c[0]]

    def get_brands(self) -> List[str]:
        """Get distinct brands."""
        brands = (
            self.db.query(SparePart.merek)
            .filter(
                SparePart.deleted_at.is_(None),
                SparePart.merek.isnot(None),
            )
            .distinct()
            .all()
        )
        return [b[0] for b in brands if b[0]]

    def import_from_excel(self, file_content: bytes) -> Dict[str, Any]:
        """Import spare parts from Excel file.
        
        Expected columns (Fixed Order):
        A: Kode Barang (Internal)
        B: Nama (Required) 
        C: Kode Part (OEM / Mfg Code)
        D: Kategori
        E: Merek
        F: Satuan
        G: Stok
        H: Stok Minimum
        I: Harga Beli
        J: Harga Jual
        K: Lokasi Rak
        L: Catatan
        """
        try:
            wb = openpyxl.load_workbook(io.BytesIO(file_content), data_only=True)
            sheet = wb.active
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Gagal membaca file Excel: {str(e)}"
            )

        results = {
            "total": 0,
            "success": 0,
            "updated": 0,
            "failed": 0,
            "errors": []
        }

        # Skip header (starting from row 2)
        for row_idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
            # Column mapping
            # A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7, I=8, J=9, K=10
            if not any(row): continue  # Skip empty rows
            
            results["total"] += 1
            kode = str(row[0]).strip() if row[0] else None
            nama = str(row[1]).strip() if row[1] else None
            
            if not nama:
                results["failed"] += 1
                results["errors"].append(f"Baris {row_idx}: Nama spare part wajib diisi")
                continue

            # Data parsing with defaults
            try:
                data = {
                    "nama": nama,
                    "kode_part": str(row[2]).strip() if row[2] else None,
                    "kategori": str(row[3]) if row[3] else "Umum",
                    "merek": str(row[4]) if row[4] else None,
                    "satuan": str(row[5]) if row[5] else "pcs",
                    "stok": int(row[6]) if row[6] is not None else 0,
                    "stok_minimum": int(row[7]) if row[7] is not None else 5,
                    "harga_beli": Decimal(str(row[8] or 0)),
                    "harga_jual": Decimal(str(row[9] or 0)),
                    "lokasi_rak": str(row[10]) if row[10] else None,
                    "catatan": str(row[11]) if row[11] else None
                }
            except (ValueError, TypeError, Decimal.InvalidOperation) as e:
                results["failed"] += 1
                results["errors"].append(f"Baris {row_idx}: Format data numerik tidak valid ({str(e)})")
                continue

            # Check if exists by kode or nama
            spare_part = None
            if kode:
                spare_part = self.db.query(SparePart).filter(SparePart.kode == kode).first()
            
            if not spare_part:
                # Try finding by exact name (non-deleted)
                spare_part = self.db.query(SparePart).filter(
                    SparePart.nama == nama,
                    SparePart.deleted_at.is_(None)
                ).first()

            try:
                if spare_part:
                    # Update existing
                    for key, value in data.items():
                        setattr(spare_part, key, value)
                    results["updated"] += 1
                else:
                    # Create new
                    new_spare_part = SparePart(
                        kode=kode if kode else self.generate_next_kode(),
                        **data
                    )
                    self.db.add(new_spare_part)
                    results["success"] += 1
                
                # Commit every few rows or at the end? For safety, let's commit often but flush first
                self.db.flush()
            except Exception as e:
                self.db.rollback()
                results["failed"] += 1
                results["errors"].append(f"Baris {row_idx}: Terjadi kesalahan database ({str(e)})")
                continue

        self.db.commit()
        return results
