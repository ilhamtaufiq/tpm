from datetime import datetime, date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Dict, Any, List

from sqlalchemy import and_, func, or_
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
from app.utils.helpers import get_jakarta_date
from app.services.gaji_akrual_service import (
    GAJI_AKRUAL_MULAI,
    akrual_gaji_periode,
    hadir_dan_gaji_slip,
)


def get_week_dates(tahun: int, minggu: int) -> tuple[date, date]:
    """Senin–Sabtu untuk nomor minggu ISO.

    Harus sama dengan get_current_week (ISO) dan UI: slip yang dibuat per minggu
    menghitung absensi di tanggal yang benar, bukan minggu lain.
    """
    try:
        week_start = date.fromisocalendar(tahun, minggu, 1)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Minggu {minggu} tidak ada di tahun {tahun}",
        )
    return week_start, week_start + timedelta(days=5)


def get_current_week(tanggal: date = None) -> tuple[int, int]:
    """Get week number and year for a date."""
    if tanggal is None:
        tanggal = date.today()
    iso_cal = tanggal.isocalendar()
    return iso_cal[1], iso_cal[0]  # week, year


class SlipGajiPreviewItem:
    """Preview item for slip gaji generation."""
    def __init__(self, karyawan_id: int, karyawan_nama: str, karyawan_kode: str,
                 gaji_pokok: Decimal, jumlah_hadir: int, potongan_kasbon: Decimal, uang_lembur: Decimal = Decimal("0")):
        self.karyawan_id = karyawan_id
        self.karyawan_nama = karyawan_nama
        self.karyawan_kode = karyawan_kode
        self.gaji_pokok = gaji_pokok
        self.jumlah_hadir = jumlah_hadir
        self.potongan_kasbon = potongan_kasbon
        self.uang_lembur = uang_lembur
        self.gaji_bersih = gaji_pokok + uang_lembur - potongan_kasbon


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

    def _hadir_dan_gaji(
        self,
        karyawan: Karyawan,
        tanggal_mulai: date,
        tanggal_akhir: date,
        hadir_input: Optional[Any] = None,
    ) -> tuple[Decimal, Decimal]:
        """Jumlah hadir & gaji pokok slip.

        Periode >= GAJI_AKRUAL_MULAI: dari absensi (sudah diakui saat diisi), hadir
        input yang berbeda ditolak. Periode lama: rumus lama (Gaji Pokok / 6 x hadir).
        """
        if tanggal_mulai >= GAJI_AKRUAL_MULAI:
            hadir, gaji = hadir_dan_gaji_slip(self.db, karyawan.id, tanggal_mulai, tanggal_akhir)
            if hadir_input is not None and Decimal(str(hadir_input)) != hadir:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Jumlah hadir {hadir_input} untuk {karyawan.nama} tidak sama dengan absensi ({hadir}). Akrual gaji mengikuti absensi; ubah absensi dulu.",
                )
            return hadir, gaji

        if hadir_input is not None:
            hadir = Decimal(str(hadir_input))
        else:
            hadir = self._get_weekly_attendance(karyawan.id, tanggal_mulai, tanggal_akhir)
        daily_rate = karyawan.gaji_pokok / Decimal("6")
        gaji = (daily_rate * hadir).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        return hadir, gaji

    def _pastikan_periode_selesai(self, tanggal_mulai: date, tanggal_akhir: date) -> None:
        """Slip periode akrual hanya dibuat setelah periodenya selesai. Kalau tidak,
        absensi hari-hari berikutnya ikut terkunci dan akrualnya tidak masuk slip."""
        if tanggal_mulai < GAJI_AKRUAL_MULAI:
            return
        if tanggal_akhir > get_jakarta_date():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Periode {tanggal_mulai} s/d {tanggal_akhir} belum selesai. Slip gaji dibuat setelah {tanggal_akhir}.",
            )

    def _slip_bentrok(
        self,
        karyawan_id: int,
        tanggal_mulai: date,
        tanggal_akhir: date,
        minggu: int,
        tahun: int,
    ) -> Optional[SlipGaji]:
        """Slip yang menghalangi pembuatan slip baru: satu slip per karyawan per minggu
        (unique constraint) atau rentang tanggal yang tumpang tindih (akrual tidak boleh
        dibayar dua kali)."""
        return (
            self.db.query(SlipGaji)
            .filter(
                SlipGaji.karyawan_id == karyawan_id,
                or_(
                    and_(SlipGaji.periode_minggu == minggu, SlipGaji.periode_tahun == tahun),
                    and_(SlipGaji.tanggal_mulai <= tanggal_akhir, SlipGaji.tanggal_akhir >= tanggal_mulai),
                ),
            )
            .first()
        )

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
        self._pastikan_periode_selesai(tanggal_mulai, tanggal_akhir)

        # Jumlah hadir & gaji pokok (akrual dari absensi untuk periode baru)
        jumlah_hadir, gaji_pokok_pro_rated = self._hadir_dan_gaji(karyawan, tanggal_mulai, tanggal_akhir)

        # Get kasbon and overtime from data or default to 0
        potongan_kasbon = data.potongan_kasbon if data.potongan_kasbon is not None else Decimal("0")
        uang_lembur = data.uang_lembur if data.uang_lembur is not None else Decimal("0")

        # Generate slip number
        nomor_slip = self._generate_nomor_slip(data.periode_minggu, data.periode_tahun)

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
            uang_lembur=uang_lembur,
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

            # Attendance & gaji pokok (akrual dari absensi untuk periode baru)
            jumlah_hadir, gaji_pokok_pro_rated = self._hadir_dan_gaji(emp, tanggal_mulai, tanggal_akhir)

            # Get kasbon
            kasbon_total = self._get_kasbon_total(emp.id)
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
            # Sudah punya slip di rentang ini: tidak perlu muncul sebagai pending.
            m_slip, t_slip = get_current_week(tanggal_mulai)
            if self._slip_bentrok(emp.id, tanggal_mulai, tanggal_akhir, m_slip, t_slip):
                continue

            # Attendance & gaji pokok dalam rentang (akrual dari absensi untuk periode baru)
            jumlah_hadir, gaji_pokok_pro_rated = self._hadir_dan_gaji(emp, tanggal_mulai, tanggal_akhir)

            # Get kasbon
            kasbon_total = self._get_kasbon_total(emp.id)
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

                # Get kasbon and overtime from item or default to 0
                potongan_kasbon = Decimal(str(item.get("potongan_kasbon", 0)))
                uang_lembur_item = Decimal(str(item.get("uang_lembur", 0)))

                # Generate slip number
                nomor_slip = self._generate_nomor_slip(minggu, tahun)

                # Gaji pokok: akrual absensi untuk periode baru, rumus lama untuk periode lama
                hadir_val, gaji_pokok_pro_rated = self._hadir_dan_gaji(
                    karyawan, tanggal_mulai, tanggal_akhir, jumlah_hadir
                )

                # Create slip with overridden attendance, kasbon, and overtime
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
                    uang_lembur=uang_lembur_item,
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
            return {"created": 0, "skipped": 0, "total_employees": 0, "skipped_detail": []}
        self._pastikan_periode_selesai(tanggal_mulai, tanggal_akhir)

        created = 0
        skipped = 0
        skipped_detail: List[str] = []
        for item in items:
            karyawan_id = item.get("karyawan_id")
            jumlah_hadir = item.get("jumlah_hadir", 0)

            # Get employee
            karyawan = (
                self.db.query(Karyawan)
                .filter(Karyawan.id == karyawan_id)
                .first()
            )
            if not karyawan:
                continue

            # Sudah ada slip di minggu ini atau rentang yang tumpang tindih: dilewati, dilaporkan.
            existing = self._slip_bentrok(karyawan_id, tanggal_mulai, tanggal_akhir, minggu, tahun)
            if existing:
                skipped += 1
                skipped_detail.append(
                    f"{karyawan.nama}: sudah ada slip {existing.nomor_slip} ({existing.tanggal_mulai} s/d {existing.tanggal_akhir})"
                )
                continue

            # Get kasbon and overtime from item or default to 0
            potongan_kasbon = Decimal(str(item.get("potongan_kasbon", 0)))
            uang_lembur_item = Decimal(str(item.get("uang_lembur", 0)))

            # Generate slip number
            nomor_slip = self._generate_nomor_slip(minggu, tahun)

            # Gaji pokok: akrual absensi untuk periode baru, rumus lama untuk periode lama
            hadir_val, gaji_pokok_pro_rated = self._hadir_dan_gaji(
                karyawan, tanggal_mulai, tanggal_akhir, jumlah_hadir
            )

            # Create slip with range dates, kasbon and overtime
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
                uang_lembur=uang_lembur_item,
                status=PaymentStatus.BELUM_LUNAS,
                created_by=user_id,
            )
            slip.calculate_totals()

            self.db.add(slip)
            created += 1

        self.db.commit()
        return {
            "created": created,
            "skipped": skipped,
            "total_employees": len(items),
            "skipped_detail": skipped_detail,
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
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
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

        # Pay-date range filter (drill-down gaji/lembur per periode laporan)
        if tanggal_dari:
            query = query.filter(SlipGaji.tanggal_bayar >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(SlipGaji.tanggal_bayar <= tanggal_sampai)

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
            func.sum(SlipGaji.uang_lembur).label("total_uang_lembur"),
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
            func.sum(SlipGaji.gaji_bersih).label("total"),
            func.sum(SlipGaji.gaji_pokok).label("total_gaji_pokok"),
            func.sum(SlipGaji.uang_lembur).label("total_uang_lembur"),
            func.sum(SlipGaji.potongan_kasbon).label("total_potongan_kasbon"),
        ).first()

        # Gaji pokok slip periode baru sudah diakui sebagai beban saat absensi diisi
        # (lihat gaji_akrual_service), jadi hanya slip periode lama yang jadi beban di sini.
        gaji_pokok_lama = (
            query.filter(SlipGaji.tanggal_mulai < GAJI_AKRUAL_MULAI)
            .with_entities(func.sum(SlipGaji.gaji_pokok))
            .scalar()
        ) or Decimal("0")

        return {
            "count": result.count or 0,
            "total": float(result.total or 0),
            "total_gaji_pokok": float(gaji_pokok_lama),
            "total_gaji_pokok_akrual": float(akrual_gaji_periode(self.db, tanggal_dari, tanggal_sampai)),
            "total_uang_lembur": float(result.total_uang_lembur or 0),
            "total_potongan_kasbon": float(result.total_potongan_kasbon or 0),
        }
