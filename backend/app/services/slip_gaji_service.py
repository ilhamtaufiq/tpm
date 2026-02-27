from datetime import datetime, date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Dict, Any, List

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from app.models.karyawan import Karyawan, Absensi, SlipGaji, KasbonKaryawan
from app.schemas.karyawan import SlipGajiCreate, SlipGajiUpdate
from app.utils.constants import (
    AttendanceStatus,
    EmployeeStatus,
    PaymentStatus,
    PaymentMethod,
    TRANSACTION_PREFIXES,
    KasBankType,
    KasBankSource,
)
from app.services.kas_bank_integration import create_kas_entry


def get_week_dates(tahun: int, minggu: int) -> tuple[date, date]:
    """Get start and end dates for a week number."""
    # Get first day of year
    first_day = date(tahun, 1, 1)
    # Find first Monday
    days_to_monday = (7 - first_day.weekday()) % 7
    if first_day.weekday() != 0:
        first_monday = first_day + timedelta(days=days_to_monday)
    else:
        first_monday = first_day

    # Calculate week start (Monday)
    week_start = first_monday + timedelta(weeks=minggu - 1)
    # Week end is Saturday (6 days for workweek Mon-Sat)
    week_end = week_start + timedelta(days=5)

    return week_start, week_end


def get_current_week(tanggal: date = None) -> tuple[int, int]:
    """Get week number and year for a date."""
    if tanggal is None:
        tanggal = date.today()
    iso_cal = tanggal.isocalendar()
    return iso_cal[1], iso_cal[0]  # week, year


class SlipGajiPreviewItem:
    """Preview item for slip gaji generation."""
    def __init__(self, karyawan_id: int, karyawan_nama: str, karyawan_kode: str,
                 gaji_pokok: Decimal, jumlah_hadir: int, potongan_kasbon: Decimal):
        self.karyawan_id = karyawan_id
        self.karyawan_nama = karyawan_nama
        self.karyawan_kode = karyawan_kode
        self.gaji_pokok = gaji_pokok
        self.jumlah_hadir = jumlah_hadir
        self.potongan_kasbon = potongan_kasbon
        self.gaji_bersih = gaji_pokok - potongan_kasbon


class SlipGajiService:
    """Service for employee weekly payroll management."""

    def __init__(self, db: Session):
        self.db = db

    def _generate_nomor_slip(self, minggu: int, tahun: int) -> str:
        """Generate unique payroll slip number."""
        prefix = TRANSACTION_PREFIXES["slip_gaji"]
        date_str = f"{tahun % 100:02d}W{minggu:02d}"

        last = (
            self.db.query(SlipGaji)
            .filter(SlipGaji.nomor_slip.like(f"{prefix}{date_str}%"))
            .order_by(SlipGaji.id.desc())
            .first()
        )

        if last:
            last_num = int(last.nomor_slip[-4:])
            new_num = last_num + 1
        else:
            new_num = 1

        return f"{prefix}{date_str}{new_num:04d}"

    def _get_weekly_attendance(
        self,
        karyawan_id: int,
        tanggal_mulai: date,
        tanggal_akhir: date,
    ) -> Decimal:
        """Get attendance count for a week (half-days count as 0.5)."""
        absences = (
            self.db.query(Absensi)
            .filter(
                Absensi.karyawan_id == karyawan_id,
                Absensi.tanggal >= tanggal_mulai,
                Absensi.tanggal <= tanggal_akhir,
                Absensi.status.in_([AttendanceStatus.HADIR, AttendanceStatus.SETENGAH_HARI]),
            )
            .all()
        )
        
        total = Decimal("0")
        for a in absences:
            if a.status == AttendanceStatus.HADIR:
                total += Decimal("1.0")
            elif a.status == AttendanceStatus.SETENGAH_HARI:
                total += Decimal("0.5")
                
        return total

        return total

    def _get_kasbon_total(self, karyawan_id: int) -> Decimal:
        """Get total unpaid kasbon for employee using PiutangUsaha remaining balance."""
        from app.models.keuangan import PiutangUsaha
        from app.utils.constants import PiutangSource, PiutangStatus

        # Joining with KasbonKaryawan to filter by karyawan_id
        result = (
            self.db.query(func.sum(PiutangUsaha.sisa_piutang))
            .join(KasbonKaryawan, KasbonKaryawan.id == PiutangUsaha.referensi_id)
            .filter(
                PiutangUsaha.sumber == PiutangSource.KASBON_KARYAWAN,
                PiutangUsaha.status != PiutangStatus.LUNAS,
                KasbonKaryawan.karyawan_id == karyawan_id,
            )
            .scalar()
        )
        return result or Decimal("0")

    def create(
        self,
        data: SlipGajiCreate,
        user_id: Optional[int] = None,
    ) -> SlipGaji:
        """Create a new weekly payroll slip."""
        # Validate employee
        karyawan = (
            self.db.query(Karyawan)
            .filter(
                Karyawan.id == data.karyawan_id,
                Karyawan.deleted_at.is_(None),
            )
            .first()
        )
        if not karyawan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Karyawan tidak ditemukan",
            )

        # Check if already exists for the period
        existing = (
            self.db.query(SlipGaji)
            .filter(
                SlipGaji.karyawan_id == data.karyawan_id,
                SlipGaji.periode_minggu == data.periode_minggu,
                SlipGaji.periode_tahun == data.periode_tahun,
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Slip gaji untuk minggu {data.periode_minggu}/{data.periode_tahun} sudah ada",
            )

        # Get week dates
        tanggal_mulai, tanggal_akhir = get_week_dates(data.periode_tahun, data.periode_minggu)

        # Get attendance count
        jumlah_hadir = self._get_weekly_attendance(
            data.karyawan_id,
            tanggal_mulai,
            tanggal_akhir,
        )

        # Get kasbon deduction from data or default to 0 (as per user request: don't cut automatically)
        potongan_kasbon = data.potongan_kasbon if data.potongan_kasbon is not None else Decimal("0")

        # Generate slip number
        nomor_slip = self._generate_nomor_slip(data.periode_minggu, data.periode_tahun)

        # Calculate pro-rated salary: (Gaji Pokok / 6) * jumlah_hadir
        daily_rate = karyawan.gaji_pokok / Decimal("6")
        gaji_pokok_pro_rated = (daily_rate * jumlah_hadir).quantize(Decimal("1"), rounding=ROUND_HALF_UP)

        # Create slip
        slip = SlipGaji(
            nomor_slip=nomor_slip,
            karyawan_id=data.karyawan_id,
            periode_minggu=data.periode_minggu,
            periode_tahun=data.periode_tahun,
            tanggal_mulai=tanggal_mulai,
            tanggal_akhir=tanggal_akhir,
            jumlah_hadir=jumlah_hadir,
            gaji_pokok=gaji_pokok_pro_rated,
            potongan_kasbon=potongan_kasbon,
            status=PaymentStatus.BELUM_LUNAS,
            created_by=user_id,
        )

        # Calculate totals
        slip.calculate_totals()

        self.db.add(slip)
        self.db.commit()
        self.db.refresh(slip)

        return slip

    def get_preview(
        self,
        minggu: int,
        tahun: int,
    ) -> Dict[str, Any]:
        """Get preview of employees for slip gaji generation with calculated attendance."""
        tanggal_mulai, tanggal_akhir = get_week_dates(tahun, minggu)

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

        items = []
        for emp in employees:
            # Check if already exists
            existing = (
                self.db.query(SlipGaji)
                .filter(
                    SlipGaji.karyawan_id == emp.id,
                    SlipGaji.periode_minggu == minggu,
                    SlipGaji.periode_tahun == tahun,
                )
                .first()
            )
            if existing:
                continue

            # Get attendance
            jumlah_hadir = self._get_weekly_attendance(emp.id, tanggal_mulai, tanggal_akhir)

            # Get kasbon
            kasbon_total = self._get_kasbon_total(emp.id)

            # Pro-rated formula: (Gaji Pokok / 6) * jumlah_hadir
            daily_rate = emp.gaji_pokok / Decimal("6")
            gaji_pokok_pro_rated = (daily_rate * jumlah_hadir).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            gaji_bersih = gaji_pokok_pro_rated

            items.append({
                "karyawan_id": emp.id,
                "karyawan_nama": emp.nama,
                "karyawan_kode": emp.kode,
                "gaji_pokok_dasar": float(emp.gaji_pokok),
                "gaji_pokok": float(gaji_pokok_pro_rated),
                "jumlah_hadir": float(jumlah_hadir),
                "total_kasbon": float(kasbon_total),
                "potongan_kasbon": 0,
                "gaji_bersih": float(gaji_bersih),
            })

        return {
            "periode_minggu": minggu,
            "periode_tahun": tahun,
            "tanggal_mulai": tanggal_mulai.isoformat(),
            "tanggal_akhir": tanggal_akhir.isoformat(),
            "items": items,
        }

    def get_preview_by_range(
        self,
        tanggal_mulai: date,
        tanggal_akhir: date,
    ) -> Dict[str, Any]:
        """Get preview of employees for slip gaji generation within a custom date range."""
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

        items = []
        for emp in employees:
            # Get attendance within range
            jumlah_hadir = self._get_weekly_attendance(emp.id, tanggal_mulai, tanggal_akhir)

            # Get kasbon
            kasbon_total = self._get_kasbon_total(emp.id)

            # Pro-rated formula: (Gaji Pokok / 6) * jumlah_hadir
            daily_rate = emp.gaji_pokok / Decimal("6")
            gaji_pokok_pro_rated = (daily_rate * jumlah_hadir).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            gaji_bersih = gaji_pokok_pro_rated - kasbon_total

            items.append({
                "karyawan_id": emp.id,
                "karyawan_nama": emp.nama,
                "karyawan_kode": emp.kode,
                "gaji_pokok_dasar": float(emp.gaji_pokok),
                "gaji_pokok": float(gaji_pokok_pro_rated),
                "jumlah_hadir": float(jumlah_hadir),
                "total_kasbon": float(kasbon_total),
                "potongan_kasbon": 0,
                "gaji_bersih": float(gaji_bersih),
            })

        return {
            "tanggal_mulai": tanggal_mulai.isoformat(),
            "tanggal_akhir": tanggal_akhir.isoformat(),
            "items": items,
        }

    def create_bulk(
        self,
        minggu: int,
        tahun: int,
        items: Optional[List[Dict[str, Any]]] = None,
        user_id: Optional[int] = None,
        tanggal_mulai_override: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create payroll slips for employees with optional attendance override."""
        tanggal_mulai, tanggal_akhir = get_week_dates(tahun, minggu)

        # Apply start date override if provided
        if tanggal_mulai_override:
            try:
                tanggal_mulai = datetime.strptime(tanggal_mulai_override, "%Y-%m-%d").date()
            except ValueError:
                pass

        # If items provided, use them (with attendance override)
        if items:
            created = 0
            for item in items:
                karyawan_id = item.get("karyawan_id")
                jumlah_hadir = item.get("jumlah_hadir", 0)

                # Skip if already exists
                existing = (
                    self.db.query(SlipGaji)
                    .filter(
                        SlipGaji.karyawan_id == karyawan_id,
                        SlipGaji.periode_minggu == minggu,
                        SlipGaji.periode_tahun == tahun,
                    )
                    .first()
                )
                if existing:
                    continue

                # Get employee
                karyawan = (
                    self.db.query(Karyawan)
                    .filter(Karyawan.id == karyawan_id)
                    .first()
                )
                if not karyawan:
                    continue

                # Get kasbon deduction from item or default to 0
                potongan_kasbon = Decimal(str(item.get("potongan_kasbon", 0)))

                # Generate slip number
                nomor_slip = self._generate_nomor_slip(minggu, tahun)

                # Calculate pro-rated salary: (Gaji Pokok / 6) * jumlah_hadir
                # Note: item.get("jumlah_hadir") might be float now
                hadir_val = Decimal(str(jumlah_hadir))
                daily_rate = karyawan.gaji_pokok / Decimal("6")
                gaji_pokok_pro_rated = (daily_rate * hadir_val).quantize(Decimal("1"), rounding=ROUND_HALF_UP)

                # Create slip with overridden attendance and kasbon
                slip = SlipGaji(
                    nomor_slip=nomor_slip,
                    karyawan_id=karyawan_id,
                    periode_minggu=minggu,
                    periode_tahun=tahun,
                    tanggal_mulai=tanggal_mulai,
                    tanggal_akhir=tanggal_akhir,
                    jumlah_hadir=hadir_val,
                    gaji_pokok=gaji_pokok_pro_rated,
                    potongan_kasbon=potongan_kasbon,
                    status=PaymentStatus.BELUM_LUNAS,
                    created_by=user_id,
                )
                slip.calculate_totals()

                self.db.add(slip)
                created += 1

            self.db.commit()
            return {
                "created": created,
                "skipped": 0,
                "total_employees": len(items),
            }

    def create_bulk_by_range(
        self,
        tanggal_mulai: date,
        tanggal_akhir: date,
        minggu: int,
        tahun: int,
        items: Optional[List[Dict[str, Any]]] = None,
        user_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Create payroll slips for a custom date range."""
        if not items:
            return {"created": 0, "skipped": 0, "total_employees": 0}

        created = 0
        for item in items:
            karyawan_id = item.get("karyawan_id")
            jumlah_hadir = item.get("jumlah_hadir", 0)

            # Check if already exists for this specific period
            existing = (
                self.db.query(SlipGaji)
                .filter(
                    SlipGaji.karyawan_id == karyawan_id,
                    SlipGaji.periode_minggu == minggu,
                    SlipGaji.periode_tahun == tahun,
                )
                .first()
            )
            if existing:
                continue

            # Get employee
            karyawan = (
                self.db.query(Karyawan)
                .filter(Karyawan.id == karyawan_id)
                .first()
            )
            if not karyawan:
                continue

            # Get kasbon deduction from item or default to 0
            potongan_kasbon = Decimal(str(item.get("potongan_kasbon", 0)))

            # Generate slip number
            nomor_slip = self._generate_nomor_slip(minggu, tahun)

            # Calculate pro-rated salary: (Gaji Pokok / 6) * jumlah_hadir
            hadir_val = Decimal(str(jumlah_hadir))
            daily_rate = karyawan.gaji_pokok / Decimal("6")
            gaji_pokok_pro_rated = (daily_rate * hadir_val).quantize(Decimal("1"), rounding=ROUND_HALF_UP)

            # Create slip with range dates and kasbon
            slip = SlipGaji(
                nomor_slip=nomor_slip,
                karyawan_id=karyawan_id,
                periode_minggu=minggu,
                periode_tahun=tahun,
                tanggal_mulai=tanggal_mulai,
                tanggal_akhir=tanggal_akhir,
                jumlah_hadir=hadir_val,
                gaji_pokok=gaji_pokok_pro_rated,
                potongan_kasbon=potongan_kasbon,
                status=PaymentStatus.BELUM_LUNAS,
                created_by=user_id,
            )
            slip.calculate_totals()

            self.db.add(slip)
            created += 1

        self.db.commit()
        return {
            "created": created,
            "skipped": 0,
            "total_employees": len(items),
        }

        # Otherwise, auto-calculate for all active employees
        employees = (
            self.db.query(Karyawan)
            .filter(
                Karyawan.deleted_at.is_(None),
                Karyawan.status == EmployeeStatus.AKTIF,
            )
            .all()
        )

        created = 0
        skipped = 0

        for emp in employees:
            # Skip if already exists
            existing = (
                self.db.query(SlipGaji)
                .filter(
                    SlipGaji.karyawan_id == emp.id,
                    SlipGaji.periode_minggu == minggu,
                    SlipGaji.periode_tahun == tahun,
                )
                .first()
            )
            if existing:
                skipped += 1
                continue

            data = SlipGajiCreate(
                karyawan_id=emp.id,
                periode_minggu=minggu,
                periode_tahun=tahun,
            )
            self.create(data, user_id)
            created += 1

        return {
            "created": created,
            "skipped": skipped,
            "total_employees": len(employees),
        }

    def get_by_id(self, slip_id: int) -> SlipGaji:
        """Get payroll slip by ID."""
        slip = (
            self.db.query(SlipGaji)
            .options(joinedload(SlipGaji.karyawan))
            .filter(SlipGaji.id == slip_id)
            .first()
        )
        if not slip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Slip gaji tidak ditemukan",
            )
        return slip

    def get_by_nomor(self, nomor_slip: str) -> Optional[SlipGaji]:
        """Get payroll slip by number."""
        return (
            self.db.query(SlipGaji)
            .options(joinedload(SlipGaji.karyawan))
            .filter(SlipGaji.nomor_slip == nomor_slip)
            .first()
        )

    def get_list(
        self,
        skip: int = 0,
        limit: int = 20,
        karyawan_id: Optional[int] = None,
        periode_minggu: Optional[int] = None,
        periode_tahun: Optional[int] = None,
        status: Optional[PaymentStatus] = None,
        sort_by: str = "periode_tahun",
        sort_order: str = "desc",
    ) -> Dict[str, Any]:
        """Get list of payroll slips with pagination and filters."""
        query = self.db.query(SlipGaji).options(joinedload(SlipGaji.karyawan))

        # Employee filter
        if karyawan_id:
            query = query.filter(SlipGaji.karyawan_id == karyawan_id)

        # Period filters
        if periode_minggu:
            query = query.filter(SlipGaji.periode_minggu == periode_minggu)
        if periode_tahun:
            query = query.filter(SlipGaji.periode_tahun == periode_tahun)

        # Status filter
        if status:
            query = query.filter(SlipGaji.status == status)

        # Count total
        total = query.count()

        # Sorting
        if sort_by == "periode":
            if sort_order == "desc":
                query = query.order_by(
                    SlipGaji.periode_tahun.desc(),
                    SlipGaji.periode_minggu.desc(),
                )
            else:
                query = query.order_by(
                    SlipGaji.periode_tahun.asc(),
                    SlipGaji.periode_minggu.asc(),
                )
        else:
            sort_column = getattr(SlipGaji, sort_by, SlipGaji.created_at)
            if sort_order == "desc":
                query = query.order_by(sort_column.desc())
            else:
                query = query.order_by(sort_column.asc())

        # Pagination
        slips = query.offset(skip).limit(limit).all()

        # Calculate pages
        pages = (total + limit - 1) // limit if limit > 0 else 1

        return {
            "data": slips,
            "total": total,
            "page": (skip // limit) + 1 if limit > 0 else 1,
            "size": limit,
            "pages": pages,
        }

    def process_payment(
        self,
        slip_id: int,
        data: SlipGajiUpdate,
        user_id: Optional[int] = None,
    ) -> SlipGaji:
        """Process salary payment."""
        slip = self.get_by_id(slip_id)

        if slip.status == PaymentStatus.LUNAS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Slip gaji sudah dibayar",
            )

        # Prepare slip update (don't commit yet)
        if data.payments:
            slip.metode_bayar = PaymentMethod.SPLIT
        else:
            slip.metode_bayar = data.metode_bayar
            
        slip.tanggal_bayar = date.today()
        slip.status = PaymentStatus.LUNAS
        slip.catatan = data.catatan

        karyawan_nama = slip.karyawan.nama if slip.karyawan else "Unknown"

        # Record salary payment to kas/bank
        if data.payments:
            total_pay = sum(Decimal(str(p.get("nominal", 0))) for p in data.payments)
            if total_pay != slip.gaji_bersih:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Total pembayaran ({total_pay}) tidak sesuai dengan nominal gaji ({slip.gaji_bersih})",
                )
            
            for p in data.payments:
                p_nominal = Decimal(str(p.get("nominal", 0)))
                if p_nominal <= 0:
                    continue
                p_metode = p.get("metode")
                create_kas_entry(
                    db=self.db,
                    tanggal=date.today(),
                    tipe=KasBankType.KELUAR,
                    nominal=p_nominal,
                    sumber=KasBankSource.GAJI,
                    metode_bayar=p_metode,
                    referensi_id=slip.id,
                    nomor_referensi=slip.nomor_slip,
                    keterangan=f"Gaji minggu {slip.periode_minggu}/{slip.periode_tahun} - {karyawan_nama} ({str(p_metode).upper()})",
                    user_id=user_id,
                )
        else:
            create_kas_entry(
                db=self.db,
                tanggal=date.today(),
                tipe=KasBankType.KELUAR,
                nominal=slip.gaji_bersih,
                sumber=KasBankSource.GAJI,
                metode_bayar=data.metode_bayar,
                referensi_id=slip.id,
                nomor_referensi=slip.nomor_slip,
                keterangan=f"Gaji minggu {slip.periode_minggu}/{slip.periode_tahun} - {karyawan_nama}",
                user_id=user_id,
            )

        # If there's a kasbon deduction, record it in KasbonService
        if slip.potongan_kasbon > 0:
            from app.services.kasbon_service import KasbonService
            kasbon_service = KasbonService(self.db)
            kasbon_service.apply_payment_from_payroll(
                karyawan_id=slip.karyawan_id,
                amount=slip.potongan_kasbon,
                slip_id=slip.id,
                nomor_slip=slip.nomor_slip,
                user_id=user_id,
            )
            
        self.db.commit()
        self.db.refresh(slip)
        return slip
    
    def void_payment(
        self,
        slip_id: int,
        user_id: Optional[int] = None,
    ) -> SlipGaji:
        """Void/cancel salary payment."""
        slip = self.get_by_id(slip_id)

        if slip.status != PaymentStatus.LUNAS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Hanya slip gaji yang sudah lunas yang dapat dibatalkan pembayarannya",
            )

        # Record reversing entry to kas/bank (money coming back in)
        karyawan_nama = slip.karyawan.nama if slip.karyawan else "Unknown"
        create_kas_entry(
            db=self.db,
            tanggal=date.today(),
            tipe=KasBankType.MASUK,
            nominal=slip.gaji_bersih,
            sumber=KasBankSource.GAJI,
            metode_bayar=slip.metode_bayar,
            referensi_id=slip.id,
            nomor_referensi=slip.nomor_slip,
            keterangan=f"PEMBATALAN: Gaji minggu {slip.periode_minggu}/{slip.periode_tahun} - {karyawan_nama}",
            user_id=user_id,
        )

        # If there was a kasbon deduction, void it
        if slip.potongan_kasbon > 0:
            from app.services.kasbon_service import KasbonService
            kasbon_service = KasbonService(self.db)
            kasbon_service.void_payroll_payment(
                slip_id=slip.id,
                nomor_slip=slip.nomor_slip,
            )

        # Reset slip payment status
        slip.status = PaymentStatus.BELUM_LUNAS
        slip.metode_bayar = None
        slip.tanggal_bayar = None
        
        self.db.commit()
        self.db.refresh(slip)

        return slip

    def delete(self, slip_id: int) -> bool:
        """Delete payroll slip."""
        slip = self.get_by_id(slip_id)

        if slip.status == PaymentStatus.LUNAS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat menghapus slip gaji yang sudah dibayar",
            )

        self.db.delete(slip)
        self.db.commit()

        return True

    def get_weekly_summary(
        self,
        minggu: int,
        tahun: int,
    ) -> Dict[str, Any]:
        """Get summary of payroll for a week."""
        tanggal_mulai, tanggal_akhir = get_week_dates(tahun, minggu)

        query = self.db.query(SlipGaji).filter(
            SlipGaji.periode_minggu == minggu,
            SlipGaji.periode_tahun == tahun,
        )

        total_slips = query.count()

        aggregates = query.with_entities(
            func.sum(SlipGaji.gaji_pokok).label("total_gaji_pokok"),
            func.sum(SlipGaji.potongan_kasbon).label("total_potongan_kasbon"),
            func.sum(SlipGaji.gaji_bersih).label("total_gaji_bersih"),
        ).first()

        # Paid vs unpaid
        paid_total = (
            query.filter(SlipGaji.status == PaymentStatus.LUNAS)
            .with_entities(func.sum(SlipGaji.gaji_bersih))
            .scalar()
        ) or Decimal("0")

        unpaid_total = (
            query.filter(SlipGaji.status != PaymentStatus.LUNAS)
            .with_entities(func.sum(SlipGaji.gaji_bersih))
            .scalar()
        ) or Decimal("0")

        return {
            "periode_minggu": minggu,
            "periode_tahun": tahun,
            "tanggal_mulai": tanggal_mulai.isoformat(),
            "tanggal_akhir": tanggal_akhir.isoformat(),
            "total_karyawan": total_slips,
            "total_gaji_pokok": float(aggregates.total_gaji_pokok or 0),
            "total_potongan_kasbon": float(aggregates.total_potongan_kasbon or 0),
            "total_gaji_bersih": float(aggregates.total_gaji_bersih or 0),
            "total_dibayar": float(paid_total),
            "total_belum_dibayar": float(unpaid_total),
        }
    def get_summary_by_date_range(
        self,
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
    ) -> Dict[str, Any]:
        """Get summary of paid payroll for a date range."""
        query = self.db.query(SlipGaji).filter(SlipGaji.status == PaymentStatus.LUNAS)

        if tanggal_dari:
            query = query.filter(SlipGaji.tanggal_bayar >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(SlipGaji.tanggal_bayar <= tanggal_sampai)

        result = query.with_entities(
            func.count(SlipGaji.id).label("count"),
            func.sum(SlipGaji.gaji_pokok).label("total"),
        ).first()

        return {
            "count": result.count or 0,
            "total": float(result.total or 0),
        }
