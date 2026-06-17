from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any, List

from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.jasa_angkut import Supir, MuatanJasaAngkut
from app.schemas.jasa_angkut import SupirCreate, SupirUpdate
from app.realtime import publish_realtime_event
from app.utils.constants import PaymentStatus, MuatanStatus


class SupirService:
    """Service for driver management."""

    def __init__(self, db: Session):
        self.db = db

    def _emit_change(self, action: str, supir: Optional[Supir] = None, supir_id: Optional[int] = None) -> None:
        entity_id = supir.id if supir else supir_id
        publish_realtime_event(
            event=f"master.supir.{action}",
            scope="master",
            entity="supir",
            action=action,
            entity_id=entity_id,
            data={"kode": getattr(supir, "kode", None), "nama": getattr(supir, "nama", None)},
        )

    def _generate_kode(self) -> str:
        """Generate unique driver code."""
        today = datetime.now()
        prefix = "SPR"  # Supir
        date_str = today.strftime("%y%m")

        last = (
            self.db.query(Supir)
            .filter(Supir.kode.like(f"{prefix}{date_str}%"))
            .order_by(Supir.id.desc())
            .first()
        )

        if last:
            last_num = int(last.kode[-4:])
            new_num = last_num + 1
        else:
            new_num = 1

        return f"{prefix}{date_str}{new_num:04d}"

    def create(self, data: SupirCreate) -> Supir:
        """Create a new driver."""
        # Check duplicate name
        existing = (
            self.db.query(Supir)
            .filter(
                Supir.nama == data.nama,
                Supir.deleted_at.is_(None),
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Supir dengan nama '{data.nama}' sudah ada",
            )

        # Generate kode if not provided
        kode = data.kode if data.kode else self._generate_kode()

        # Check duplicate kode
        existing_kode = self.db.query(Supir).filter(Supir.kode == kode).first()
        if existing_kode:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Kode supir '{kode}' sudah digunakan",
            )

        supir = Supir(
            kode=kode,
            nama=data.nama,
            nik=data.nik,
            alamat=data.alamat,
            telepon=data.telepon,
            nomor_sim=data.nomor_sim,
            jenis_sim=data.jenis_sim,
            tanggal_bergabung=data.tanggal_bergabung,
            is_active=True,
            catatan=data.catatan,
        )

        self.db.add(supir)
        self.db.commit()
        self.db.refresh(supir)
        self._emit_change("created", supir)

        return supir

    def get_by_id(self, supir_id: int) -> Supir:
        """Get driver by ID."""
        supir = (
            self.db.query(Supir)
            .filter(
                Supir.id == supir_id,
                Supir.deleted_at.is_(None),
            )
            .first()
        )
        if not supir:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Supir tidak ditemukan",
            )
        return supir

    def get_by_kode(self, kode: str) -> Optional[Supir]:
        """Get driver by code."""
        return (
            self.db.query(Supir)
            .filter(
                Supir.kode == kode,
                Supir.deleted_at.is_(None),
            )
            .first()
        )

    def get_list(
        self,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
        sort_by: str = "nama",
        sort_order: str = "asc",
    ) -> Dict[str, Any]:
        """Get list of drivers with pagination and filters."""
        query = self.db.query(Supir).filter(Supir.deleted_at.is_(None))

        # Search filter
        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                or_(
                    Supir.nama.ilike(search_filter),
                    Supir.kode.ilike(search_filter),
                    Supir.telepon.ilike(search_filter),
                )
            )

        # Active filter
        if is_active is not None:
            query = query.filter(Supir.is_active == is_active)

        # Count total
        total = query.count()

        # Sorting
        sort_column = getattr(Supir, sort_by, Supir.nama)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        # Pagination
        supirs = query.offset(skip).limit(limit).all()

        # Calculate pages
        pages = (total + limit - 1) // limit if limit > 0 else 1

        return {
            "data": supirs,
            "total": total,
            "page": (skip // limit) + 1 if limit > 0 else 1,
            "size": limit,
            "pages": pages,
        }

    def update(self, supir_id: int, data: SupirUpdate) -> Supir:
        """Update driver information."""
        supir = self.get_by_id(supir_id)

        update_data = data.model_dump(exclude_unset=True)

        # Check duplicate name if changing
        if "nama" in update_data and update_data["nama"] != supir.nama:
            existing = (
                self.db.query(Supir)
                .filter(
                    Supir.nama == update_data["nama"],
                    Supir.id != supir_id,
                    Supir.deleted_at.is_(None),
                )
                .first()
            )
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Supir dengan nama '{update_data['nama']}' sudah ada",
                )

        for field, value in update_data.items():
            setattr(supir, field, value)

        self.db.commit()
        self.db.refresh(supir)
        self._emit_change("updated", supir)

        return supir

    def set_active(self, supir_id: int, is_active: bool) -> Supir:
        """Set driver active status."""
        supir = self.get_by_id(supir_id)
        supir.is_active = is_active
        self.db.commit()
        self.db.refresh(supir)
        self._emit_change("status_updated", supir)
        return supir

    def delete(self, supir_id: int) -> bool:
        """Soft delete driver."""
        supir = self.get_by_id(supir_id)

        # Check if has transactions
        has_muatan = (
            self.db.query(MuatanJasaAngkut)
            .filter(MuatanJasaAngkut.supir_id == supir_id)
            .first()
        )
        if has_muatan:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat menghapus supir yang memiliki riwayat transaksi",
            )

        supir.deleted_at = datetime.now()
        self.db.commit()
        self._emit_change("deleted", supir)

        return True

    def get_summary(self, supir_id: int) -> Dict[str, Any]:
        """Get driver summary with statistics."""
        supir = self.get_by_id(supir_id)

        # Calculate statistics
        muatan_query = self.db.query(MuatanJasaAngkut).filter(
            MuatanJasaAngkut.supir_id == supir_id
        )

        total_muatan = muatan_query.count()

        aggregates = muatan_query.with_entities(
            func.sum(MuatanJasaAngkut.pendapatan_kotor).label("total_pendapatan"),
            func.sum(MuatanJasaAngkut.laba_tpm).label("total_laba_tpm"),
            func.sum(MuatanJasaAngkut.laba_supir).label("total_laba_supir"),
        ).first()

        # Unpaid transactions
        unpaid = (
            muatan_query.filter(
                MuatanJasaAngkut.status_bayar != PaymentStatus.LUNAS
            )
            .with_entities(func.sum(MuatanJasaAngkut.laba_supir))
            .scalar()
            or Decimal("0")
        )

        return {
            "supir": supir,
            "total_muatan": total_muatan,
            "total_pendapatan": float(aggregates.total_pendapatan or 0),
            "total_laba_tpm": float(aggregates.total_laba_tpm or 0),
            "total_laba_supir": float(aggregates.total_laba_supir or 0),
            "piutang_supir": float(unpaid),
        }

    def search(
        self,
        query: str,
        active_only: bool = True,
        limit: int = 10,
    ) -> List[Supir]:
        """Search drivers for autocomplete."""
        search_filter = f"%{query}%"
        q = self.db.query(Supir).filter(
            Supir.deleted_at.is_(None),
            or_(
                Supir.nama.ilike(search_filter),
                Supir.kode.ilike(search_filter),
            ),
        )

        if active_only:
            q = q.filter(Supir.is_active == True)

        return q.order_by(Supir.nama.asc()).limit(limit).all()

    def get_active_drivers(self) -> List[Supir]:
        """Get all active drivers with readiness status."""
        drivers = (
            self.db.query(Supir)
            .filter(
                Supir.deleted_at.is_(None),
                Supir.is_active == True,
            )
            .order_by(Supir.nama.asc())
            .all()
        )

        # Drivers currently having 'PROSES' trips
        busy_driver_ids = {
            uid[0] for uid in self.db.query(MuatanJasaAngkut.supir_id)
            .filter(
                MuatanJasaAngkut.status == MuatanStatus.PROSES,
                MuatanJasaAngkut.supir_id.is_not(None)
            ).all()
        }

        for driver in drivers:
            driver.is_ready = driver.id not in busy_driver_ids

        return drivers
