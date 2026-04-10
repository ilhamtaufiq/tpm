from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any, List

from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.bengkel import PengeluaranBengkel, SparePart
from app.models.mobil import Mobil, MobilPartService
from app.models.jasa_angkut import MuatanJasaAngkut, JasaAngkutPartService
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

        metode_bayar_enum = data.metode_bayar if isinstance(data.metode_bayar, PaymentMethod) else PaymentMethod(str(data.metode_bayar).upper())

        # If SPLIT, validate payments sum up to total
        if metode_bayar_enum == PaymentMethod.SPLIT:
            if not data.payments:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Detail pembayaran split wajib diisi",
                )
            total_split = sum(p.jumlah for p in data.payments)
            if total_split != data.jumlah:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Total pembayaran split ({total_split}) tidak sama dengan jumlah pengeluaran ({data.jumlah})",
                )

        pengeluaran = PengeluaranBengkel(
            nomor_transaksi=nomor_transaksi,
            tanggal=data.tanggal,
            bisnis_kategori=data.bisnis_kategori,
            muatan_id=data.muatan_id,
            armada_id=data.armada_id,
            mobil_id=data.mobil_id,
            kategori=data.kategori,
            deskripsi=data.deskripsi,
            jumlah=data.jumlah,
            metode_bayar=metode_bayar_enum,
            catatan=data.catatan,
            created_by=user_id,
        )

        self.db.add(pengeluaran)
        self.db.flush()
        self.db.refresh(pengeluaran)

        # Record expense to kas/bank (money going out)
        # Skip if payment method is KREDIT (debt)
        if metode_bayar_enum == PaymentMethod.SPLIT:
            # Determine source based on category
            kas_source = KasBankSource.PENGELUARAN
            if data.kategori == ExpenseCategory.PRIVE:
                kas_source = KasBankSource.PRIVE

            for p in data.payments:
                 create_kas_entry(
                    db=self.db,
                    tanggal=data.tanggal,
                    tipe=KasBankType.KELUAR,
                    nominal=p.jumlah,
                    sumber=kas_source,
                    metode_bayar=p.metode,
                    referensi_id=pengeluaran.id,
                    nomor_referensi=pengeluaran.nomor_transaksi,
                    keterangan=f"Pengeluaran {data.kategori.value} (Split {p.metode.value}): {data.deskripsi}",
                    user_id=user_id,
                    kas_jenis=data.kas_jenis, # Using provided BOP account if any
                )
        elif metode_bayar_enum != PaymentMethod.KREDIT:
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
                metode_bayar=metode_bayar_enum,
                referensi_id=pengeluaran.id,
                nomor_referensi=pengeluaran.nomor_transaksi,
                keterangan=f"Pengeluaran {data.kategori.value}: {data.deskripsi}",
                user_id=user_id,
                kas_jenis=data.kas_jenis,
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

        # Clean linked costs
        self.db.query(JasaAngkutPartService).filter(
            JasaAngkutPartService.catatan.like(f"Pengeluaran Bengkel: {pengeluaran.nomor_transaksi}")
        ).delete(synchronize_session=False)

        self.db.query(MobilPartService).filter(
            MobilPartService.catatan.like(f"Pengeluaran Bengkel: {pengeluaran.nomor_transaksi}")
        ).delete(synchronize_session=False)

        self.db.delete(pengeluaran)
        self.db.commit()

        return True

    def get_summary(
        self,
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
    ) -> Dict[str, Any]:
        """Get expense summary statistics."""
        # Default to current month if no dates provided
        if not tanggal_dari and not tanggal_sampai:
            today = date.today()
            tanggal_dari = date(today.year, today.month, 1)
            tanggal_sampai = today

        query = self.db.query(PengeluaranBengkel).filter(
            PengeluaranBengkel.bisnis_kategori.in_(["umum", "bengkel", "penjualan_mobil", "jasa_angkut", "mobil", "jual_beli_mobil"])
        )

        if tanggal_dari:
            query = query.filter(PengeluaranBengkel.tanggal >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(PengeluaranBengkel.tanggal <= tanggal_sampai)

        # Total expenses
        total_count = query.count()
        
        # Calculate sum separately to be safe from with_entities issues
        sum_query = self.db.query(func.sum(PengeluaranBengkel.jumlah)).filter(
            PengeluaranBengkel.bisnis_kategori.in_(["umum", "bengkel", "penjualan_mobil", "jasa_angkut", "mobil", "jual_beli_mobil"])
        )
        if tanggal_dari:
            sum_query = sum_query.filter(PengeluaranBengkel.tanggal >= tanggal_dari)
        if tanggal_sampai:
            sum_query = sum_query.filter(PengeluaranBengkel.tanggal <= tanggal_sampai)
        
        total_value = sum_query.scalar() or Decimal("0")

        # By category
        cat_query = self.db.query(
            PengeluaranBengkel.kategori,
            func.count(PengeluaranBengkel.id),
            func.sum(PengeluaranBengkel.jumlah)
        ).filter(
            PengeluaranBengkel.bisnis_kategori.in_(["umum", "bengkel", "penjualan_mobil", "jasa_angkut", "mobil", "jual_beli_mobil"])
        )
        if tanggal_dari:
            cat_query = cat_query.filter(PengeluaranBengkel.tanggal >= tanggal_dari)
        if tanggal_sampai:
            cat_query = cat_query.filter(PengeluaranBengkel.tanggal <= tanggal_sampai)
            
        by_category = cat_query.group_by(PengeluaranBengkel.kategori).all()

        category_summary = {
            cat.value.lower(): {"count": 0, "total": 0.0} for cat in ExpenseCategory
        }
        for kat, count, total in by_category:
            if kat:
                key = str(kat).lower()
                category_summary[key] = {
                    "count": count,
                    "total": float(total or 0),
                }

        # By business unit
        unit_query = self.db.query(
            PengeluaranBengkel.bisnis_kategori,
            func.sum(PengeluaranBengkel.jumlah)
        ).filter(
            PengeluaranBengkel.bisnis_kategori.in_(["umum", "bengkel", "penjualan_mobil", "jasa_angkut", "mobil", "jual_beli_mobil"])
        )
        if tanggal_dari:
            unit_query = unit_query.filter(PengeluaranBengkel.tanggal >= tanggal_dari)
        if tanggal_sampai:
            unit_query = unit_query.filter(PengeluaranBengkel.tanggal <= tanggal_sampai)
            
        by_unit = unit_query.group_by(PengeluaranBengkel.bisnis_kategori).all()
        unit_summary = {row[0]: float(row[1] or 0) for row in by_unit}

        # Breakdown Jasa Angkut by Armada
        from app.models.jasa_angkut import ArmadaJasaAngkut
        armada_ja_query = self.db.query(
            ArmadaJasaAngkut.nama,
            func.sum(PengeluaranBengkel.jumlah)
        ).join(
            ArmadaJasaAngkut, PengeluaranBengkel.armada_id == ArmadaJasaAngkut.id
        ).filter(
            PengeluaranBengkel.bisnis_kategori == "jasa_angkut"
        )
        if tanggal_dari:
            armada_ja_query = armada_ja_query.filter(PengeluaranBengkel.tanggal >= tanggal_dari)
        if tanggal_sampai:
            armada_ja_query = armada_ja_query.filter(PengeluaranBengkel.tanggal <= tanggal_sampai)
        
        by_armada_ja = armada_ja_query.group_by(ArmadaJasaAngkut.nama).all()
        armada_ja_summary = {row[0]: float(row[1] or 0) for row in by_armada_ja}

        return {
            "total_transaksi": total_count,
            "total_pengeluaran": float(total_value),
            "total_jumlah": float(total_value),
            "count": total_count,
            "per_kategori": category_summary,
            "per_unit": unit_summary,
            "jasa_angkut_armada": armada_ja_summary,
            "period": {
                "start": tanggal_dari.isoformat() if tanggal_dari else None,
                "end": tanggal_sampai.isoformat() if tanggal_sampai else None,
            }
        }

    def get_daily_summary(self, tanggal: date) -> Dict[str, Any]:
        """Get daily expense summary."""
        query = self.db.query(PengeluaranBengkel).filter(
            PengeluaranBengkel.tanggal == tanggal,
            PengeluaranBengkel.bisnis_kategori.in_(["umum", "bengkel", "penjualan_mobil", "jasa_angkut", "mobil", "jual_beli_mobil"])
        )

        count = query.count()
        
        # Calculate sum separately
        total = (
            self.db.query(func.sum(PengeluaranBengkel.jumlah)).filter(
                PengeluaranBengkel.tanggal == tanggal,
                PengeluaranBengkel.bisnis_kategori.in_(["umum", "bengkel", "penjualan_mobil", "jasa_angkut", "mobil", "jual_beli_mobil"])
            ).scalar()
            or Decimal("0")
        )

        # By category for the day
        by_category_query = self.db.query(
            PengeluaranBengkel.kategori,
            func.sum(PengeluaranBengkel.jumlah).label("total"),
        ).filter(
            PengeluaranBengkel.tanggal == tanggal,
            PengeluaranBengkel.bisnis_kategori.in_(["umum", "bengkel", "penjualan_mobil", "jasa_angkut", "mobil", "jual_beli_mobil"])
        ).group_by(PengeluaranBengkel.kategori)
        
        by_category = by_category_query.all()

        category_totals = {}
        for row in by_category:
            if row.kategori:
                category_totals[str(row.kategori).lower()] = float(row.total or 0)

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

        base_filter = [
            PengeluaranBengkel.tanggal >= start_date,
            PengeluaranBengkel.tanggal <= end_date,
            PengeluaranBengkel.bisnis_kategori.in_(["umum", "bengkel", "penjualan_mobil", "jasa_angkut", "mobil", "jual_beli_mobil"])
        ]

        query = self.db.query(PengeluaranBengkel).filter(*base_filter)

        total_count = query.count()
        total_value = (
            self.db.query(func.sum(PengeluaranBengkel.jumlah)).filter(*base_filter).scalar()
            or Decimal("0")
        )

        # Daily breakdown
        daily_query = (
            self.db.query(
                PengeluaranBengkel.tanggal,
                func.count(PengeluaranBengkel.id).label("count"),
                func.sum(PengeluaranBengkel.jumlah).label("total"),
            )
            .filter(*base_filter)
            .group_by(PengeluaranBengkel.tanggal)
            .order_by(PengeluaranBengkel.tanggal)
        )
        daily = daily_query.all()

        daily_data = [
            {
                "tanggal": row.tanggal.isoformat(),
                "count": row.count,
                "total": float(row.total or 0),
            }
            for row in daily
        ]

        # By category
        cat_query = (
            self.db.query(
                PengeluaranBengkel.kategori,
                func.count(PengeluaranBengkel.id).label("count"),
                func.sum(PengeluaranBengkel.jumlah).label("total"),
            )
            .filter(*base_filter)
            .group_by(PengeluaranBengkel.kategori)
        )
        by_category = cat_query.all()

        category_summary = {}
        for row in by_category:
            if row.kategori:
                category_summary[str(row.kategori).lower()] = {
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
