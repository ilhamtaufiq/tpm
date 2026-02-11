from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any, List

from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.bengkel import PengeluaranBengkel
from app.schemas.bengkel import PengeluaranBengkelCreate, PengeluaranBengkelUpdate
from app.utils.constants import (
    ExpenseCategory,
    PaymentMethod,
    TRANSACTION_PREFIXES,
    KasBankType,
    KasBankSource,
)
from app.services.kas_bank_integration import create_kas_entry


class PengeluaranService:
    """Service for workshop expense management."""

    def __init__(self, db: Session):
        self.db = db

    def _generate_nomor_transaksi(self) -> str:
        """Generate unique expense transaction number."""
        today = datetime.now()
        prefix = TRANSACTION_PREFIXES["pengeluaran"]
        date_str = today.strftime("%y%m%d")

        last = (
            self.db.query(PengeluaranBengkel)
            .filter(PengeluaranBengkel.nomor_transaksi.like(f"{prefix}{date_str}%"))
            .order_by(PengeluaranBengkel.id.desc())
            .first()
        )

        if last:
            last_num = int(last.nomor_transaksi[-4:])
            new_num = last_num + 1
        else:
            new_num = 1

        return f"{prefix}{date_str}{new_num:04d}"

    def create(
        self,
        data: PengeluaranBengkelCreate,
        user_id: Optional[int] = None,
    ) -> PengeluaranBengkel:
        """Create a new expense record."""
        nomor_transaksi = self._generate_nomor_transaksi()

        pengeluaran = PengeluaranBengkel(
            nomor_transaksi=nomor_transaksi,
            tanggal=data.tanggal,
            kategori=data.kategori,
            deskripsi=data.deskripsi,
            jumlah=data.jumlah,
            metode_bayar=data.metode_bayar,
            catatan=data.catatan,
            created_by=user_id,
        )

        self.db.add(pengeluaran)
        self.db.flush()  # Flush to get ID for referensi_id

        # Record expense to kas/bank (money going out)
        # Skip if payment method is KREDIT (debt)
        if data.metode_bayar != PaymentMethod.KREDIT:
            # Determine source based on category
            kas_source = KasBankSource.PENGELUARAN
            if data.kategori == ExpenseCategory.PRIVE:
                kas_source = KasBankSource.PRIVE

            create_kas_entry(
                db=self.db,
                tanggal=data.tanggal,
                tipe=KasBankType.KELUAR,
                nominal=data.jumlah,
                sumber=kas_source,
                metode_bayar=data.metode_bayar,
                referensi_id=pengeluaran.id,
                nomor_referensi=pengeluaran.nomor_transaksi,
                keterangan=f"Pengeluaran {data.kategori.value}: {data.deskripsi}",
                user_id=user_id,
            )

        return pengeluaran

    def get_by_id(self, pengeluaran_id: int) -> PengeluaranBengkel:
        """Get expense by ID."""
        pengeluaran = (
            self.db.query(PengeluaranBengkel)
            .filter(PengeluaranBengkel.id == pengeluaran_id)
            .first()
        )
        if not pengeluaran:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pengeluaran tidak ditemukan",
            )
        return pengeluaran

    def get_by_nomor(self, nomor_transaksi: str) -> Optional[PengeluaranBengkel]:
        """Get expense by transaction number."""
        return (
            self.db.query(PengeluaranBengkel)
            .filter(PengeluaranBengkel.nomor_transaksi == nomor_transaksi)
            .first()
        )

    def get_list(
        self,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        kategori: Optional[ExpenseCategory] = None,
        metode_bayar: Optional[PaymentMethod] = None,
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
        sort_by: str = "tanggal",
        sort_order: str = "desc",
    ) -> Dict[str, Any]:
        """Get list of expenses with pagination and filters."""
        query = self.db.query(PengeluaranBengkel)

        # Search filter
        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                or_(
                    PengeluaranBengkel.nomor_transaksi.ilike(search_filter),
                    PengeluaranBengkel.deskripsi.ilike(search_filter),
                )
            )

        # Category filter
        if kategori:
            query = query.filter(PengeluaranBengkel.kategori == kategori)

        # Payment method filter
        if metode_bayar:
            query = query.filter(PengeluaranBengkel.metode_bayar == metode_bayar)

        # Date range filter
        if tanggal_dari:
            query = query.filter(PengeluaranBengkel.tanggal >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(PengeluaranBengkel.tanggal <= tanggal_sampai)

        # Count total
        total = query.count()

        # Sorting
        sort_column = getattr(PengeluaranBengkel, sort_by, PengeluaranBengkel.tanggal)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        # Pagination
        pengeluarans = query.offset(skip).limit(limit).all()

        # Calculate pages
        pages = (total + limit - 1) // limit if limit > 0 else 1

        return {
            "data": pengeluarans,
            "total": total,
            "page": (skip // limit) + 1 if limit > 0 else 1,
            "size": limit,
            "pages": pages,
        }

    def update(
        self,
        pengeluaran_id: int,
        data: PengeluaranBengkelUpdate,
    ) -> PengeluaranBengkel:
        """Update expense record."""
        pengeluaran = self.get_by_id(pengeluaran_id)

        update_data = data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(pengeluaran, field, value)

        self.db.commit()
        self.db.refresh(pengeluaran)

        return pengeluaran

    def delete(self, pengeluaran_id: int) -> bool:
        """Delete expense record."""
        pengeluaran = self.get_by_id(pengeluaran_id)

        self.db.delete(pengeluaran)
        self.db.commit()

        return True

    def get_summary(
        self,
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
    ) -> Dict[str, Any]:
        """Get expense summary statistics."""
        query = self.db.query(PengeluaranBengkel)

        if tanggal_dari:
            query = query.filter(PengeluaranBengkel.tanggal >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(PengeluaranBengkel.tanggal <= tanggal_sampai)

        # Total expenses
        total_count = query.count()
        total_value = (
            query.with_entities(func.sum(PengeluaranBengkel.jumlah)).scalar()
            or Decimal("0")
        )

        # By category
        by_category = (
            query.with_entities(
                PengeluaranBengkel.kategori,
                func.count(PengeluaranBengkel.id).label("count"),
                func.sum(PengeluaranBengkel.jumlah).label("total"),
            )
            .group_by(PengeluaranBengkel.kategori)
            .all()
        )

        category_summary = {
            cat.value: {"count": 0, "total": 0.0} for cat in ExpenseCategory
        }
        for row in by_category:
            if row.kategori:
                # row.kategori is now a string because we changed the model to String
                category_summary[row.kategori] = {
                    "count": row.count,
                    "total": float(row.total or 0),
                }

        return {
            "total_transaksi": total_count,
            "total_pengeluaran": float(total_value),
            "per_kategori": category_summary,
        }

    def get_daily_summary(self, tanggal: date) -> Dict[str, Any]:
        """Get daily expense summary."""
        query = self.db.query(PengeluaranBengkel).filter(
            PengeluaranBengkel.tanggal == tanggal
        )

        count = query.count()
        total = (
            query.with_entities(func.sum(PengeluaranBengkel.jumlah)).scalar()
            or Decimal("0")
        )

        # By category for the day
        by_category = (
            query.with_entities(
                PengeluaranBengkel.kategori,
                func.sum(PengeluaranBengkel.jumlah).label("total"),
            )
            .group_by(PengeluaranBengkel.kategori)
            .all()
        )

        category_totals = {}
        for row in by_category:
            if row.kategori:
                category_totals[row.kategori.value] = float(row.total or 0)

        return {
            "tanggal": tanggal.isoformat(),
            "jumlah_transaksi": count,
            "total_pengeluaran": float(total),
            "per_kategori": category_totals,
        }

    def get_monthly_summary(self, year: int, month: int) -> Dict[str, Any]:
        """Get monthly expense summary."""
        from calendar import monthrange

        start_date = date(year, month, 1)
        _, last_day = monthrange(year, month)
        end_date = date(year, month, last_day)

        query = self.db.query(PengeluaranBengkel).filter(
            PengeluaranBengkel.tanggal >= start_date,
            PengeluaranBengkel.tanggal <= end_date,
        )

        total_count = query.count()
        total_value = (
            query.with_entities(func.sum(PengeluaranBengkel.jumlah)).scalar()
            or Decimal("0")
        )

        # Daily breakdown
        daily = (
            query.with_entities(
                PengeluaranBengkel.tanggal,
                func.count(PengeluaranBengkel.id).label("count"),
                func.sum(PengeluaranBengkel.jumlah).label("total"),
            )
            .group_by(PengeluaranBengkel.tanggal)
            .order_by(PengeluaranBengkel.tanggal)
            .all()
        )

        daily_data = [
            {
                "tanggal": row.tanggal.isoformat(),
                "count": row.count,
                "total": float(row.total or 0),
            }
            for row in daily
        ]

        # By category
        by_category = (
            query.with_entities(
                PengeluaranBengkel.kategori,
                func.count(PengeluaranBengkel.id).label("count"),
                func.sum(PengeluaranBengkel.jumlah).label("total"),
            )
            .group_by(PengeluaranBengkel.kategori)
            .all()
        )

        category_summary = {}
        for row in by_category:
            if row.kategori:
                category_summary[row.kategori.value] = {
                    "count": row.count,
                    "total": float(row.total or 0),
                }

        return {
            "tahun": year,
            "bulan": month,
            "total_transaksi": total_count,
            "total_pengeluaran": float(total_value),
            "per_hari": daily_data,
            "per_kategori": category_summary,
        }
