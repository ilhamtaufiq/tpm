from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any, List

from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.karyawan import Karyawan, Absensi, KasbonKaryawan
from app.schemas.karyawan import KaryawanCreate, KaryawanUpdate
from app.utils.constants import (
    EmployeeStatus,
    PaymentStatus,
    AttendanceStatus,
    TRANSACTION_PREFIXES,
)


class KaryawanService:
    """Service for employee management."""

    def __init__(self, db: Session):
        self.db = db

    def _generate_kode(self) -> str:
        """Generate unique employee code."""
        today = datetime.now()
        prefix = TRANSACTION_PREFIXES["karyawan"]
        date_str = today.strftime("%y%m")

        last = (
            self.db.query(Karyawan)
            .filter(Karyawan.kode.like(f"{prefix}{date_str}%"))
            .order_by(Karyawan.id.desc())
            .first()
        )

        if last:
            last_num = int(last.kode[-4:])
            new_num = last_num + 1
        else:
            new_num = 1

        return f"{prefix}{date_str}{new_num:04d}"

    def create(self, data: KaryawanCreate) -> Karyawan:
        """Create a new employee."""
        # Check duplicate name
        existing = (
            self.db.query(Karyawan)
            .filter(
                Karyawan.nama == data.nama,
                Karyawan.deleted_at.is_(None),
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Karyawan dengan nama '{data.nama}' sudah ada",
            )

        # Generate kode if not provided
        kode = data.kode if data.kode else self._generate_kode()

        # Check duplicate kode
        existing_kode = self.db.query(Karyawan).filter(Karyawan.kode == kode).first()
        if existing_kode:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Kode karyawan '{kode}' sudah digunakan",
            )

        karyawan = Karyawan(
            kode=kode,
            nama=data.nama,
            nik=data.nik,
            jabatan=data.jabatan,
            alamat=data.alamat,
            telepon=data.telepon,
            email=data.email,
            tanggal_lahir=data.tanggal_lahir,
            tanggal_bergabung=data.tanggal_bergabung,
            gaji_pokok=data.gaji_pokok,
            tunjangan=data.tunjangan,
            status=EmployeeStatus.AKTIF,
            catatan=data.catatan,
        )

        self.db.add(karyawan)
        self.db.commit()
        self.db.refresh(karyawan)

        return karyawan

    def get_by_id(self, karyawan_id: int) -> Karyawan:
        """Get employee by ID."""
        karyawan = (
            self.db.query(Karyawan)
            .filter(
                Karyawan.id == karyawan_id,
                Karyawan.deleted_at.is_(None),
            )
            .first()
        )
        if not karyawan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Karyawan tidak ditemukan",
            )
        return karyawan

    def get_by_kode(self, kode: str) -> Optional[Karyawan]:
        """Get employee by code."""
        return (
            self.db.query(Karyawan)
            .filter(
                Karyawan.kode == kode,
                Karyawan.deleted_at.is_(None),
            )
            .first()
        )

    def get_list(
        self,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        status: Optional[EmployeeStatus] = None,
        jabatan: Optional[str] = None,
        sort_by: str = "nama",
        sort_order: str = "asc",
    ) -> Dict[str, Any]:
        """Get list of employees with pagination and filters."""
        query = self.db.query(Karyawan).filter(Karyawan.deleted_at.is_(None))

        # Search filter
        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                or_(
                    Karyawan.nama.ilike(search_filter),
                    Karyawan.kode.ilike(search_filter),
                    Karyawan.telepon.ilike(search_filter),
                )
            )

        # Status filter
        if status:
            query = query.filter(Karyawan.status == status)

        # Position filter
        if jabatan:
            query = query.filter(Karyawan.jabatan == jabatan)

        # Count total
        total = query.count()

        # Sorting
        sort_column = getattr(Karyawan, sort_by, Karyawan.nama)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        # Pagination
        karyawans = query.offset(skip).limit(limit).all()

        # Calculate pages
        pages = (total + limit - 1) // limit if limit > 0 else 1

        return {
            "data": karyawans,
            "total": total,
            "page": (skip // limit) + 1 if limit > 0 else 1,
            "size": limit,
            "pages": pages,
        }

    def update(self, karyawan_id: int, data: KaryawanUpdate) -> Karyawan:
        """Update employee information."""
        karyawan = self.get_by_id(karyawan_id)

        update_data = data.model_dump(exclude_unset=True)

        # Check duplicate name if changing
        if "nama" in update_data and update_data["nama"] != karyawan.nama:
            existing = (
                self.db.query(Karyawan)
                .filter(
                    Karyawan.nama == update_data["nama"],
                    Karyawan.id != karyawan_id,
                    Karyawan.deleted_at.is_(None),
                )
                .first()
            )
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Karyawan dengan nama '{update_data['nama']}' sudah ada",
                )

        for field, value in update_data.items():
            setattr(karyawan, field, value)

        self.db.commit()
        self.db.refresh(karyawan)

        return karyawan

    def set_status(self, karyawan_id: int, status: EmployeeStatus) -> Karyawan:
        """Set employee status."""
        karyawan = self.get_by_id(karyawan_id)

        # If resigning, set exit date
        if status == EmployeeStatus.RESIGN:
            karyawan.tanggal_keluar = date.today()

        karyawan.status = status
        self.db.commit()
        self.db.refresh(karyawan)
        return karyawan

    def delete(self, karyawan_id: int) -> bool:
        """Soft delete employee."""
        karyawan = self.get_by_id(karyawan_id)

        # Check if has unpaid kasbon
        has_kasbon = (
            self.db.query(KasbonKaryawan)
            .filter(
                KasbonKaryawan.karyawan_id == karyawan_id,
                KasbonKaryawan.status != PaymentStatus.LUNAS,
            )
            .first()
        )
        if has_kasbon:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat menghapus karyawan yang masih memiliki kasbon",
            )

        karyawan.deleted_at = datetime.utcnow()
        karyawan.status = EmployeeStatus.TIDAK_AKTIF
        self.db.commit()

        return True

    def get_summary(self, karyawan_id: int) -> Dict[str, Any]:
        """Get employee summary with statistics."""
        karyawan = self.get_by_id(karyawan_id)

        # Active kasbon total
        kasbon_aktif = (
            self.db.query(func.sum(KasbonKaryawan.nominal))
            .filter(
                KasbonKaryawan.karyawan_id == karyawan_id,
                KasbonKaryawan.status != PaymentStatus.LUNAS,
            )
            .scalar()
            or Decimal("0")
        )

        # Current month attendance
        today = date.today()
        month_start = date(today.year, today.month, 1)

        absensi_query = self.db.query(Absensi).filter(
            Absensi.karyawan_id == karyawan_id,
            Absensi.tanggal >= month_start,
            Absensi.tanggal <= today,
        )

        total_absensi = absensi_query.count()
        hadir = (
            absensi_query.filter(Absensi.status == AttendanceStatus.HADIR).count()
        )

        return {
            "karyawan": karyawan,
            "total_kasbon_aktif": float(kasbon_aktif),
            "jumlah_hadir_bulan_ini": hadir,
            "jumlah_hari_kerja_bulan_ini": total_absensi,
        }

    def search(
        self,
        query: str,
        active_only: bool = True,
        limit: int = 10,
    ) -> List[Karyawan]:
        """Search employees for autocomplete."""
        search_filter = f"%{query}%"
        q = self.db.query(Karyawan).filter(
            Karyawan.deleted_at.is_(None),
            or_(
                Karyawan.nama.ilike(search_filter),
                Karyawan.kode.ilike(search_filter),
            ),
        )

        if active_only:
            q = q.filter(Karyawan.status == EmployeeStatus.AKTIF)

        return q.order_by(Karyawan.nama.asc()).limit(limit).all()

    def get_active_employees(self) -> List[Karyawan]:
        """Get all active employees."""
        return (
            self.db.query(Karyawan)
            .filter(
                Karyawan.deleted_at.is_(None),
                Karyawan.status == EmployeeStatus.AKTIF,
            )
            .order_by(Karyawan.nama.asc())
            .all()
        )

    def get_positions(self) -> List[str]:
        """Get distinct employee positions."""
        positions = (
            self.db.query(Karyawan.jabatan)
            .filter(Karyawan.deleted_at.is_(None))
            .distinct()
            .all()
        )
        return [p[0] for p in positions if p[0]]

    def get_employee_stats(self) -> Dict[str, Any]:
        """Get overall employee statistics."""
        query = self.db.query(Karyawan).filter(Karyawan.deleted_at.is_(None))

        total = query.count()

        by_status = (
            query.with_entities(
                Karyawan.status,
                func.count(Karyawan.id).label("count"),
            )
            .group_by(Karyawan.status)
            .all()
        )

        status_counts = {s.value: 0 for s in EmployeeStatus}
        for row in by_status:
            status_counts[row.status.value] = row.count

        # Total salary expense (active employees only)
        total_gaji = (
            query.filter(Karyawan.status == EmployeeStatus.AKTIF)
            .with_entities(func.sum(Karyawan.gaji_pokok + Karyawan.tunjangan))
            .scalar()
            or Decimal("0")
        )

        return {
            "total_karyawan": total,
            "per_status": status_counts,
            "total_beban_gaji": float(total_gaji),
        }
