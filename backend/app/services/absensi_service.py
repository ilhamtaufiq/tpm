from datetime import datetime, date, time
from decimal import Decimal
from typing import Optional, Dict, Any, List
from calendar import monthrange

from sqlalchemy import func, or_, and_
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from app.models.karyawan import Karyawan, Absensi
from app.schemas.karyawan import AbsensiCreate, AbsensiUpdate
from app.utils.constants import AttendanceStatus, EmployeeStatus


class AbsensiService:
    """Service for employee attendance management."""

    def __init__(self, db: Session):
        self.db = db

    def _validate_karyawan(self, karyawan_id: int) -> Karyawan:
        """Validate employee exists and is active."""
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
        if karyawan.status != EmployeeStatus.AKTIF:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Karyawan tidak aktif",
            )
        return karyawan

    def create(self, data: AbsensiCreate) -> Absensi:
        """Create attendance record."""
        # Validate employee
        self._validate_karyawan(data.karyawan_id)

        # Check if already exists for the date
        existing = (
            self.db.query(Absensi)
            .filter(
                Absensi.karyawan_id == data.karyawan_id,
                Absensi.tanggal == data.tanggal,
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Absensi untuk tanggal {data.tanggal} sudah ada",
            )

        absensi = Absensi(
            karyawan_id=data.karyawan_id,
            tanggal=data.tanggal,
            status=data.status,
            jam_masuk=data.jam_masuk,
            jam_keluar=data.jam_keluar,
            catatan=data.catatan,
        )

        self.db.add(absensi)
        self.db.commit()
        self.db.refresh(absensi)

        return absensi

    def create_bulk(
        self,
        tanggal: date,
        items: List[AbsensiCreate],
    ) -> List[Absensi]:
        """Create multiple attendance records for a date."""
        results = []

        for item in items:
            # Skip if exists
            existing = (
                self.db.query(Absensi)
                .filter(
                    Absensi.karyawan_id == item.karyawan_id,
                    Absensi.tanggal == tanggal,
                )
                .first()
            )
            if existing:
                continue

            absensi = Absensi(
                karyawan_id=item.karyawan_id,
                tanggal=tanggal,
                status=item.status,
                jam_masuk=item.jam_masuk,
                jam_keluar=item.jam_keluar,
                catatan=item.catatan,
            )
            self.db.add(absensi)
            results.append(absensi)

        self.db.commit()

        for absensi in results:
            self.db.refresh(absensi)

        return results

    def get_by_id(self, absensi_id: int) -> Absensi:
        """Get attendance by ID."""
        absensi = (
            self.db.query(Absensi)
            .options(joinedload(Absensi.karyawan))
            .filter(Absensi.id == absensi_id)
            .first()
        )
        if not absensi:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Absensi tidak ditemukan",
            )
        return absensi

    def get_list(
        self,
        skip: int = 0,
        limit: int = 20,
        karyawan_id: Optional[int] = None,
        status: Optional[AttendanceStatus] = None,
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
        sort_by: str = "tanggal",
        sort_order: str = "desc",
    ) -> Dict[str, Any]:
        """Get list of attendance records with pagination and filters."""
        query = self.db.query(Absensi).options(joinedload(Absensi.karyawan))

        # Employee filter
        if karyawan_id:
            query = query.filter(Absensi.karyawan_id == karyawan_id)

        # Status filter
        if status:
            query = query.filter(Absensi.status == status)

        # Date range filter
        if tanggal_dari:
            query = query.filter(Absensi.tanggal >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(Absensi.tanggal <= tanggal_sampai)

        # Count total
        total = query.count()

        # Sorting
        sort_column = getattr(Absensi, sort_by, Absensi.tanggal)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        # Pagination
        absensis = query.offset(skip).limit(limit).all()

        # Calculate pages
        pages = (total + limit - 1) // limit if limit > 0 else 1

        return {
            "data": absensis,
            "total": total,
            "page": (skip // limit) + 1 if limit > 0 else 1,
            "size": limit,
            "pages": pages,
        }

    def update(self, absensi_id: int, data: AbsensiUpdate) -> Absensi:
        """Update attendance record."""
        absensi = self.get_by_id(absensi_id)

        update_data = data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(absensi, field, value)

        self.db.commit()
        self.db.refresh(absensi)

        return absensi

    def delete(self, absensi_id: int) -> bool:
        """Delete attendance record."""
        absensi = self.get_by_id(absensi_id)

        self.db.delete(absensi)
        self.db.commit()

        return True

    def get_daily(self, tanggal: date) -> Dict[str, Any]:
        """Get attendance for a specific date with all employees."""
        # Get all active employees
        employees = (
            self.db.query(Karyawan)
            .filter(
                Karyawan.deleted_at.is_(None),
                Karyawan.status == EmployeeStatus.AKTIF,
            )
            .order_by(Karyawan.nama.asc())
            .all()
        )

        # Get attendance for the date
        absensis = (
            self.db.query(Absensi)
            .filter(Absensi.tanggal == tanggal)
            .all()
        )

        absensi_map = {a.karyawan_id: a for a in absensis}

        # Build records list
        records = []
        summary = {"hadir": 0, "izin": 0, "sakit": 0, "alpha": 0, "cuti": 0, "libur": 0}

        for emp in employees:
            absensi = absensi_map.get(emp.id)
            absensi_data = None

            if absensi:
                absensi_data = {
                    "id": absensi.id,
                    "karyawan_id": absensi.karyawan_id,
                    "tanggal": absensi.tanggal.isoformat(),
                    "status": absensi.status.value,
                    "jam_masuk": absensi.jam_masuk.isoformat() if absensi.jam_masuk else None,
                    "jam_keluar": absensi.jam_keluar.isoformat() if absensi.jam_keluar else None,
                    "keterangan": absensi.catatan,
                }
                # Count summary
                status_key = absensi.status.value.lower()
                if status_key in summary:
                    summary[status_key] += 1

            records.append({
                "karyawan_id": emp.id,
                "karyawan_nama": emp.nama,
                "absensi": absensi_data,
            })

        return {
            "tanggal": tanggal.isoformat(),
            "records": records,
            "summary": summary,
        }

    def get_monthly_summary(
        self,
        karyawan_id: int,
        bulan: int,
        tahun: int,
    ) -> Dict[str, Any]:
        """Get monthly attendance summary for an employee."""
        karyawan = (
            self.db.query(Karyawan)
            .filter(Karyawan.id == karyawan_id)
            .first()
        )
        if not karyawan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Karyawan tidak ditemukan",
            )

        # Get date range
        _, last_day = monthrange(tahun, bulan)
        start_date = date(tahun, bulan, 1)
        end_date = date(tahun, bulan, last_day)

        # Count working days (exclude weekends)
        total_hari_kerja = 0
        current = start_date
        while current <= end_date:
            if current.weekday() < 5:  # Monday = 0, Friday = 4
                total_hari_kerja += 1
            current = date.fromordinal(current.toordinal() + 1)

        # Get attendance records
        query = self.db.query(Absensi).filter(
            Absensi.karyawan_id == karyawan_id,
            Absensi.tanggal >= start_date,
            Absensi.tanggal <= end_date,
        )

        # Count by status
        by_status = (
            query.with_entities(
                Absensi.status,
                func.count(Absensi.id).label("count"),
            )
            .group_by(Absensi.status)
            .all()
        )

        status_counts = {s.value: 0 for s in AttendanceStatus}
        for row in by_status:
            status_counts[row.status.value] = row.count

        hadir = status_counts.get("hadir", 0)
        persentase = (hadir / total_hari_kerja * 100) if total_hari_kerja > 0 else 0

        return {
            "karyawan_id": karyawan_id,
            "karyawan_nama": karyawan.nama,
            "periode_bulan": bulan,
            "periode_tahun": tahun,
            "total_hari_kerja": total_hari_kerja,
            "jumlah_hadir": status_counts.get("hadir", 0),
            "jumlah_izin": status_counts.get("izin", 0),
            "jumlah_sakit": status_counts.get("sakit", 0),
            "jumlah_alpha": status_counts.get("alpha", 0),
            "jumlah_cuti": status_counts.get("cuti", 0),
            "persentase_kehadiran": round(persentase, 2),
        }

    def get_all_monthly_summaries(
        self,
        bulan: int,
        tahun: int,
    ) -> List[Dict[str, Any]]:
        """Get monthly attendance summary for all employees."""
        employees = (
            self.db.query(Karyawan)
            .filter(
                Karyawan.deleted_at.is_(None),
                Karyawan.status == EmployeeStatus.AKTIF,
            )
            .order_by(Karyawan.nama.asc())
            .all()
        )

        results = []
        for emp in employees:
            summary = self.get_monthly_summary(emp.id, bulan, tahun)
            results.append(summary)

        return results

    def clock_in(
        self,
        karyawan_id: int,
        tanggal: Optional[date] = None,
        jam: Optional[time] = None,
    ) -> Absensi:
        """Record employee clock in."""
        self._validate_karyawan(karyawan_id)

        tanggal = tanggal or date.today()
        jam = jam or datetime.now().time()

        # Check if already clocked in
        existing = (
            self.db.query(Absensi)
            .filter(
                Absensi.karyawan_id == karyawan_id,
                Absensi.tanggal == tanggal,
            )
            .first()
        )

        if existing:
            if existing.jam_masuk:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Sudah melakukan clock in hari ini",
                )
            existing.jam_masuk = jam
            self.db.commit()
            self.db.refresh(existing)
            return existing

        absensi = Absensi(
            karyawan_id=karyawan_id,
            tanggal=tanggal,
            status=AttendanceStatus.HADIR,
            jam_masuk=jam,
        )

        self.db.add(absensi)
        self.db.commit()
        self.db.refresh(absensi)

        return absensi

    def clock_out(
        self,
        karyawan_id: int,
        tanggal: Optional[date] = None,
        jam: Optional[time] = None,
    ) -> Absensi:
        """Record employee clock out."""
        self._validate_karyawan(karyawan_id)

        tanggal = tanggal or date.today()
        jam = jam or datetime.now().time()

        # Find today's attendance
        absensi = (
            self.db.query(Absensi)
            .filter(
                Absensi.karyawan_id == karyawan_id,
                Absensi.tanggal == tanggal,
            )
            .first()
        )

        if not absensi:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Belum melakukan clock in",
            )

        if absensi.jam_keluar:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sudah melakukan clock out hari ini",
            )

        absensi.jam_keluar = jam
        self.db.commit()
        self.db.refresh(absensi)

        return absensi
