from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any, List

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from app.models.karyawan import Karyawan, KasbonKaryawan
from app.models.keuangan import PiutangUsaha, PembayaranPiutang
from app.schemas.karyawan import KasbonCreate
from app.utils.constants import (
    EmployeeStatus,
    PaymentStatus,
    PaymentMethod,
    PiutangStatus,
    PiutangSource,
    TRANSACTION_PREFIXES,
    KasBankType,
    KasBankSource,
)
from app.services.kas_bank_integration import create_kas_entry


class KasbonService:
    """Service for employee cash advance management."""

    def __init__(self, db: Session):
        self.db = db

    def _generate_nomor_kasbon(self) -> str:
        """Generate unique kasbon number."""
        today = datetime.now()
        prefix = TRANSACTION_PREFIXES["kasbon"]
        date_str = today.strftime("%y%m%d")

        last = (
            self.db.query(KasbonKaryawan)
            .filter(KasbonKaryawan.nomor_kasbon.like(f"{prefix}{date_str}%"))
            .order_by(KasbonKaryawan.id.desc())
            .first()
        )

        if last:
            last_num = int(last.nomor_kasbon[-4:])
            new_num = last_num + 1
        else:
            new_num = 1

        return f"{prefix}{date_str}{new_num:04d}"
    
    def _generate_nomor_piutang(self) -> str:
        """Generate unique piutang number."""
        today = datetime.now()
        prefix = TRANSACTION_PREFIXES["piutang"]
        date_str = today.strftime("%y%m%d")

        last = (
            self.db.query(PiutangUsaha)
            .filter(PiutangUsaha.nomor_piutang.like(f"{prefix}{date_str}%"))
            .order_by(PiutangUsaha.id.desc())
            .first()
        )

        if last:
            last_num = int(last.nomor_piutang[-4:])
            new_num = last_num + 1
        else:
            new_num = 1

        return f"{prefix}{date_str}{new_num:04d}"

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

    def create(
        self,
        data: KasbonCreate,
        user_id: Optional[int] = None,
    ) -> KasbonKaryawan:
        """Create a new kasbon (cash advance)."""
        # Validate employee
        karyawan = self._validate_karyawan(data.karyawan_id)

        # Generate kasbon number
        nomor_kasbon = self._generate_nomor_kasbon()

        kasbon = KasbonKaryawan(
            nomor_kasbon=nomor_kasbon,
            karyawan_id=data.karyawan_id,
            tanggal=data.tanggal,
            nominal=data.nominal,
            keterangan=data.keterangan,
            status=PaymentStatus.BELUM_LUNAS,
            catatan=data.catatan,
            created_by=user_id,
        )

        self.db.add(kasbon)
        self.db.flush()  # Get ID for piutang and kas entry

        # Create piutang record (employee owes company)
        piutang = PiutangUsaha(
            nomor_piutang=self._generate_nomor_piutang(),
            tanggal=data.tanggal,
            sumber=PiutangSource.KASBON_KARYAWAN,
            referensi_id=kasbon.id,
            nomor_referensi=nomor_kasbon,
            nominal_piutang=data.nominal,
            total_dibayar=Decimal("0"),
            sisa_piutang=data.nominal,
            status=PiutangStatus.BELUM_LUNAS,
            nama_debitur=karyawan.nama,
            catatan=f"Kasbon karyawan {karyawan.nama}",
        )
        self.db.add(piutang)

        # Record kasbon disbursement to kas/bank (money going out)
        # This will check balance and raise HTTPException if insufficient.
        # If it fails, nothing is committed to the database.
        create_kas_entry(
            db=self.db,
            tanggal=data.tanggal,
            tipe=KasBankType.KELUAR,
            nominal=data.nominal,
            sumber=KasBankSource.KASBON,
            metode_bayar=data.metode_bayar,
            referensi_id=kasbon.id,
            nomor_referensi=kasbon.nomor_kasbon,
            keterangan=f"Kasbon karyawan {karyawan.nama} ({kasbon.nomor_kasbon})",
            user_id=user_id,
        )
        
        self.db.commit()
        self.db.refresh(kasbon)
        
        return kasbon

    def get_by_id(self, kasbon_id: int) -> KasbonKaryawan:
        """Get kasbon by ID."""
        kasbon = (
            self.db.query(KasbonKaryawan)
            .options(joinedload(KasbonKaryawan.karyawan))
            .filter(KasbonKaryawan.id == kasbon_id)
            .first()
        )
        if not kasbon:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Kasbon tidak ditemukan",
            )
        return kasbon

    def get_by_nomor(self, nomor_kasbon: str) -> Optional[KasbonKaryawan]:
        """Get kasbon by number."""
        return (
            self.db.query(KasbonKaryawan)
            .options(joinedload(KasbonKaryawan.karyawan))
            .filter(KasbonKaryawan.nomor_kasbon == nomor_kasbon)
            .first()
        )

    def get_list(
        self,
        skip: int = 0,
        limit: int = 20,
        karyawan_id: Optional[int] = None,
        status: Optional[PaymentStatus] = None,
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
        sort_by: str = "tanggal",
        sort_order: str = "desc",
    ) -> Dict[str, Any]:
        """Get list of kasbon with pagination and filters."""
        query = self.db.query(KasbonKaryawan).options(
            joinedload(KasbonKaryawan.karyawan)
        )

        # Employee filter
        if karyawan_id:
            query = query.filter(KasbonKaryawan.karyawan_id == karyawan_id)

        # Status filter
        if status:
            query = query.filter(KasbonKaryawan.status == status)

        # Date range filter
        if tanggal_dari:
            query = query.filter(KasbonKaryawan.tanggal >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(KasbonKaryawan.tanggal <= tanggal_sampai)

        # Count total
        total = query.count()

        # Sorting
        sort_column = getattr(KasbonKaryawan, sort_by, KasbonKaryawan.tanggal)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        # Pagination
        kasbons = query.offset(skip).limit(limit).all()

        # Calculate pages
        pages = (total + limit - 1) // limit if limit > 0 else 1

        return {
            "data": kasbons,
            "total": total,
            "page": (skip // limit) + 1 if limit > 0 else 1,
            "size": limit,
            "pages": pages,
        }

    
    def process_payment_split(
        self,
        kasbon_id: int,
        payments: List[Dict[str, Any]],
        notes: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> KasbonKaryawan:
        """Process kasbon repayment with split payments."""
        kasbon = self.get_by_id(kasbon_id)

        if kasbon.status == PaymentStatus.LUNAS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Kasbon sudah lunas",
            )

        total_payment = sum(Decimal(str(p.get("nominal", 0))) for p in payments)
        
        # Ensure total payment matches kasbon nominal
        if total_payment != kasbon.nominal:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Total pembayaran ({total_payment}) tidak sesuai dengan nominal kasbon ({kasbon.nominal})",
            )

        today = date.today()
        kasbon.status = PaymentStatus.LUNAS
        kasbon.tanggal_lunas = today
        if notes:
            kasbon.catatan = notes

        # Update related piutang
        piutang = (
            self.db.query(PiutangUsaha)
            .filter(
                PiutangUsaha.nomor_referensi == kasbon.nomor_kasbon,
                PiutangUsaha.sumber == PiutangSource.KASBON_KARYAWAN,
            )
            .first()
        )
        if piutang:
            piutang.sisa_piutang = Decimal("0")
            piutang.status = PiutangStatus.LUNAS
            piutang.total_dibayar = kasbon.nominal # Update total paid

        # Record KasBank entries (Money IN)
        for p in payments:
            nominal = Decimal(str(p.get("nominal", 0)))
            if nominal <= 0:
                continue
                
            metode = p.get("metode", PaymentMethod.TUNAI)
            catatan = p.get("catatan") or notes
            
            create_kas_entry(
                db=self.db,
                tanggal=today,
                tipe=KasBankType.MASUK,
                nominal=nominal,
                sumber=KasBankSource.KASBON,
                metode_bayar=metode,
                referensi_id=kasbon.id,
                nomor_referensi=kasbon.nomor_kasbon,
                keterangan=f"Pelunasan kasbon {kasbon.nomor_kasbon} - {kasbon.karyawan_nama} ({metode})",
                user_id=user_id,
            )

        self.db.commit()
        self.db.refresh(kasbon)

        return kasbon

    def mark_paid(
        self,
        kasbon_id: int,
        tanggal_lunas: Optional[date] = None,
    ) -> KasbonKaryawan:
        """Mark kasbon as paid (legacy single payment)."""
        kasbon = self.get_by_id(kasbon_id)

        if kasbon.status == PaymentStatus.LUNAS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Kasbon sudah lunas",
            )

        kasbon.status = PaymentStatus.LUNAS
        kasbon.tanggal_lunas = tanggal_lunas or date.today()

        # Update related piutang
        piutang = (
            self.db.query(PiutangUsaha)
            .filter(
                PiutangUsaha.nomor_referensi == kasbon.nomor_kasbon,
                PiutangUsaha.sumber == PiutangSource.KASBON_KARYAWAN,
            )
            .first()
        )
        if piutang:
            piutang.sisa_piutang = Decimal("0")
            piutang.status = PiutangStatus.LUNAS
            
        # Also record SINGLE KasBank entry (assuming TUNAI for legacy method)
        # This fixes the missing money-in tracking for simple mark-paid
        create_kas_entry(
            db=self.db,
            tanggal=kasbon.tanggal_lunas,
            tipe=KasBankType.MASUK,
            nominal=kasbon.nominal,
            sumber=KasBankSource.KASBON,
            metode_bayar=PaymentMethod.TUNAI,
            referensi_id=kasbon.id,
            nomor_referensi=kasbon.nomor_kasbon,
            keterangan=f"Pelunasan kasbon {kasbon.nomor_kasbon} - {kasbon.karyawan_nama} (Manual)",
            user_id=None,
        )

        self.db.commit()
        self.db.refresh(kasbon)

        return kasbon

    def delete(self, kasbon_id: int) -> bool:
        """Delete kasbon (only if unpaid)."""
        kasbon = self.get_by_id(kasbon_id)

        if kasbon.status == PaymentStatus.LUNAS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat menghapus kasbon yang sudah lunas",
            )

        # Delete related piutang
        self.db.query(PiutangUsaha).filter(
            PiutangUsaha.nomor_referensi == kasbon.nomor_kasbon,
            PiutangUsaha.sumber == PiutangSource.KASBON_KARYAWAN,
        ).delete()

        self.db.delete(kasbon)
        self.db.commit()

        return True

    def get_employee_kasbon(
        self,
        karyawan_id: int,
        unpaid_only: bool = True,
    ) -> List[KasbonKaryawan]:
        """Get kasbon for specific employee."""
        query = self.db.query(KasbonKaryawan).filter(
            KasbonKaryawan.karyawan_id == karyawan_id
        )

        if unpaid_only:
            query = query.filter(KasbonKaryawan.status != PaymentStatus.LUNAS)

        return query.order_by(KasbonKaryawan.tanggal.desc()).all()

    def get_employee_kasbon_total(self, karyawan_id: int) -> Decimal:
        """Get total unpaid kasbon for employee."""
        result = (
            self.db.query(func.sum(KasbonKaryawan.nominal))
            .filter(
                KasbonKaryawan.karyawan_id == karyawan_id,
                KasbonKaryawan.status != PaymentStatus.LUNAS,
            )
            .scalar()
        )
        return result or Decimal("0")

    def get_summary(
        self,
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
    ) -> Dict[str, Any]:
        """Get kasbon summary statistics."""
        query = self.db.query(KasbonKaryawan)

        if tanggal_dari:
            query = query.filter(KasbonKaryawan.tanggal >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(KasbonKaryawan.tanggal <= tanggal_sampai)

        # Total
        total_count = query.count()
        total_nominal = (
            query.with_entities(func.sum(KasbonKaryawan.nominal)).scalar()
            or Decimal("0")
        )

        # Unpaid
        unpaid_query = query.filter(KasbonKaryawan.status != PaymentStatus.LUNAS)
        unpaid_count = unpaid_query.count()
        unpaid_nominal = (
            unpaid_query.with_entities(func.sum(KasbonKaryawan.nominal)).scalar()
            or Decimal("0")
        )

        # Lunas
        lunas_query = query.filter(KasbonKaryawan.status == PaymentStatus.LUNAS)
        lunas_count = lunas_query.count()
        lunas_nominal = (
            lunas_query.with_entities(func.sum(KasbonKaryawan.nominal)).scalar()
            or Decimal("0")
        )

        return {
            "total_kasbon": float(total_nominal),
            "total_lunas": float(lunas_nominal),
            "total_belum_lunas": float(unpaid_nominal),
            "count_total": total_count,
            "count_lunas": lunas_count,
            "count_belum_lunas": unpaid_count,
        }

    def get_top_debtors(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get employees with highest unpaid kasbon."""
        results = (
            self.db.query(
                KasbonKaryawan.karyawan_id,
                func.sum(KasbonKaryawan.nominal).label("total"),
                func.count(KasbonKaryawan.id).label("count"),
            )
            .filter(KasbonKaryawan.status != PaymentStatus.LUNAS)
            .group_by(KasbonKaryawan.karyawan_id)
            .order_by(func.sum(KasbonKaryawan.nominal).desc())
            .limit(limit)
            .all()
        )

        debtors = []
        for row in results:
            karyawan = (
                self.db.query(Karyawan)
                .filter(Karyawan.id == row.karyawan_id)
                .first()
            )
            if karyawan:
                debtors.append({
                    "karyawan_id": karyawan.id,
                    "karyawan_nama": karyawan.nama,
                    "karyawan_kode": karyawan.kode,
                    "total_kasbon": float(row.total),
                    "jumlah_kasbon": row.count,
                })

        return debtors

    def apply_payment_from_payroll(
        self,
        karyawan_id: int,
        amount: Decimal,
        slip_id: int,
        nomor_slip: str,
        user_id: Optional[int] = None,
    ) -> None:
        """Apply a payment from payroll to the employee's outstanding kasbon."""
        if amount <= 0:
            return

        # Find all unpaid kasbon for the employee, oldest first
        kasbons = (
            self.db.query(KasbonKaryawan)
            .filter(
                KasbonKaryawan.karyawan_id == karyawan_id,
                KasbonKaryawan.status != PaymentStatus.LUNAS,
            )
            .order_by(KasbonKaryawan.tanggal.asc())
            .all()
        )

        remaining_amount = amount
        today = date.today()

        for kasbon in kasbons:
            if remaining_amount <= 0:
                break

            # Find related piutang
            piutang = (
                self.db.query(PiutangUsaha)
                .filter(
                    PiutangUsaha.referensi_id == kasbon.id,
                    PiutangUsaha.sumber == PiutangSource.KASBON_KARYAWAN,
                )
                .first()
            )

            if not piutang or piutang.status == PiutangStatus.LUNAS:
                # If no piutang or already paid, sync kasbon status
                kasbon.status = PaymentStatus.LUNAS
                if not kasbon.tanggal_lunas:
                    kasbon.tanggal_lunas = today
                continue

            # Calculate amount to pay for this piutang
            pay_amount = min(remaining_amount, piutang.sisa_piutang)
            
            # Process payment in piutang
            piutang.process_payment(pay_amount)
            
            # Create payment record for piutang
            payment_rec = PembayaranPiutang(
                piutang_id=piutang.id,
                tanggal=today,
                nominal=pay_amount,
                metode_bayar=PaymentMethod.POTONG_GAJI,
                catatan=f"Potong gaji dari slip {nomor_slip}",
                created_by=user_id,
            )
            self.db.add(payment_rec)

            # Update kasbon status if fully paid
            if piutang.status == PiutangStatus.LUNAS:
                kasbon.status = PaymentStatus.LUNAS
                kasbon.tanggal_lunas = today

            remaining_amount -= pay_amount

    def void_payroll_payment(
        self,
        slip_id: int,
        nomor_slip: str,
    ) -> None:
        """Void kasbon payments associated with a payroll slip."""
        # Find all PembayaranPiutang associated with this slip
        payments = (
            self.db.query(PembayaranPiutang)
            .filter(
                PembayaranPiutang.catatan.like(f"%Potong gaji dari slip {nomor_slip}%")
            )
            .all()
        )

        for p in payments:
            piutang = p.piutang
            if not piutang:
                continue

            # Reverse the payment in piutang
            piutang.total_dibayar -= p.nominal
            piutang.sisa_piutang = piutang.nominal_piutang - piutang.total_dibayar
            
            if piutang.total_dibayar == 0:
                piutang.status = PiutangStatus.BELUM_LUNAS
                piutang.tanggal_lunas = None
            else:
                piutang.status = PiutangStatus.SEBAGIAN
                piutang.tanggal_lunas = None

            # Sync with KasbonKaryawan
            if piutang.sumber == PiutangSource.KASBON_KARYAWAN:
                kasbon = (
                    self.db.query(KasbonKaryawan)
                    .filter(KasbonKaryawan.id == piutang.referensi_id)
                    .first()
                )
                if kasbon:
                    kasbon.status = PaymentStatus.BELUM_LUNAS
                    kasbon.tanggal_lunas = None

            # Delete the payment record
            self.db.delete(p)
