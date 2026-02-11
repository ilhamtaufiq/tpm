from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any, List

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from app.models.keuangan import PiutangUsaha, PembayaranPiutang
from app.models.customer import Customer
from app.models.bengkel import TransaksiPenjualanBengkel
from app.models.jasa_angkut import MuatanJasaAngkut
from app.models.mobil import TransaksiPenjualanMobil
from app.schemas.keuangan import PiutangCreate, PiutangUpdate, PembayaranPiutangCreate
from app.utils.constants import (
    PiutangStatus,
    PiutangSource,
    PaymentMethod,
    PaymentStatus,
    TRANSACTION_PREFIXES,
    KasBankType,
    KasBankSource,
)
from app.services.kas_bank_integration import create_kas_entry


class PiutangService:
    """Service for accounts receivable management."""

    def __init__(self, db: Session):
        self.db = db

    def _generate_nomor_piutang(self) -> str:
        """Generate unique receivable number."""
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

    def create(
        self,
        data: PiutangCreate,
        user_id: Optional[int] = None,
    ) -> PiutangUsaha:
        """Create a new receivable record."""
        # Generate number
        nomor_piutang = self._generate_nomor_piutang()

        piutang = PiutangUsaha(
            nomor_piutang=nomor_piutang,
            tanggal=data.tanggal,
            sumber=data.sumber,
            referensi_id=data.referensi_id,
            nomor_referensi=data.nomor_referensi,
            customer_id=data.customer_id,
            nama_debitur=data.nama_debitur,
            telepon_debitur=data.telepon_debitur,
            alamat_debitur=data.alamat_debitur,
            nominal_piutang=data.nominal_piutang,
            total_dibayar=Decimal("0"),
            sisa_piutang=data.nominal_piutang,
            tanggal_jatuh_tempo=data.tanggal_jatuh_tempo,
            status=PiutangStatus.BELUM_LUNAS,
            catatan=data.catatan,
            created_by=user_id,
        )

        self.db.add(piutang)
        self.db.commit()
        self.db.refresh(piutang)

        # If manual piutang creation involves cash outflow (e.g. lending money)
        if data.metode_pembayaran:
            create_kas_entry(
                db=self.db,
                tanggal=data.tanggal,
                tipe=KasBankType.KELUAR,
                nominal=data.nominal_piutang,
                sumber=KasBankSource.PIUTANG,
                metode_bayar=data.metode_pembayaran,
                referensi_id=piutang.id,
                nomor_referensi=piutang.nomor_piutang,
                keterangan=f"Pemberian Piutang/Pinjaman kepada {piutang.nama_debitur}",
                user_id=user_id,
            )

        return piutang

    def get_by_id(self, piutang_id: int) -> PiutangUsaha:
        """Get receivable by ID."""
        piutang = (
            self.db.query(PiutangUsaha)
            .options(joinedload(PiutangUsaha.pembayaran))
            .filter(PiutangUsaha.id == piutang_id)
            .first()
        )
        if not piutang:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Piutang tidak ditemukan",
            )
        return piutang

    def get_by_nomor(self, nomor_piutang: str) -> Optional[PiutangUsaha]:
        """Get receivable by number."""
        return (
            self.db.query(PiutangUsaha)
            .options(joinedload(PiutangUsaha.pembayaran))
            .filter(PiutangUsaha.nomor_piutang == nomor_piutang)
            .first()
        )

    def get_list(
        self,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        customer_id: Optional[int] = None,
        sumber: Optional[PiutangSource] = None,
        status: Optional[PiutangStatus] = None,
        overdue_only: bool = False,
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
        sort_by: str = "tanggal",
        sort_order: str = "desc",
    ) -> Dict[str, Any]:
        """Get list of receivables with pagination and filters."""
        query = self.db.query(PiutangUsaha).options(
            joinedload(PiutangUsaha.pembayaran)
        )

        # Search filter
        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                or_(
                    PiutangUsaha.nomor_piutang.ilike(search_filter),
                    PiutangUsaha.nama_debitur.ilike(search_filter),
                    PiutangUsaha.nomor_referensi.ilike(search_filter),
                )
            )

        # Customer filter
        if customer_id:
            query = query.filter(PiutangUsaha.customer_id == customer_id)

        # Source filter
        if sumber:
            query = query.filter(PiutangUsaha.sumber == sumber)

        # Status filter
        if status:
            query = query.filter(PiutangUsaha.status == status)

        # Overdue filter
        if overdue_only:
            query = query.filter(
                PiutangUsaha.tanggal_jatuh_tempo < date.today(),
                PiutangUsaha.status != PiutangStatus.LUNAS,
            )

        # Date range filter
        if tanggal_dari:
            query = query.filter(PiutangUsaha.tanggal >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(PiutangUsaha.tanggal <= tanggal_sampai)

        # Count total
        total = query.count()

        # Aggregates for summary
        aggregates = query.with_entities(
            func.sum(PiutangUsaha.nominal_piutang).label("total_piutang"),
            func.sum(PiutangUsaha.total_dibayar).label("total_terbayar"),
            func.sum(PiutangUsaha.sisa_piutang).label("total_sisa"),
        ).first()

        # Sorting
        sort_column = getattr(PiutangUsaha, sort_by, PiutangUsaha.tanggal)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        # Pagination
        piutangs = query.offset(skip).limit(limit).all()

        # Calculate pages
        pages = (total + limit - 1) // limit if limit > 0 else 1

        return {
            "data": piutangs,
            "total": total,
            "page": (skip // limit) + 1 if limit > 0 else 1,
            "size": limit,
            "pages": pages,
            "total_piutang": float(aggregates.total_piutang or 0),
            "total_terbayar": float(aggregates.total_terbayar or 0),
            "total_sisa": float(aggregates.total_sisa or 0),
        }

    def update(self, piutang_id: int, data: PiutangUpdate) -> PiutangUsaha:
        """Update receivable record."""
        piutang = self.get_by_id(piutang_id)

        update_data = data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(piutang, field, value)

        self.db.commit()
        self.db.refresh(piutang)

        return piutang

    def process_payment(
        self,
        data: PembayaranPiutangCreate,
        user_id: Optional[int] = None,
    ) -> PembayaranPiutang:
        """Process payment for receivable."""
        piutang = self.get_by_id(data.piutang_id)

        if piutang.status == PiutangStatus.LUNAS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Piutang sudah lunas",
            )

        if data.nominal > piutang.sisa_piutang:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Nominal pembayaran ({data.nominal}) melebihi sisa piutang ({piutang.sisa_piutang})",
            )

        # Create payment record
        pembayaran = PembayaranPiutang(
            piutang_id=data.piutang_id,
            tanggal=data.tanggal,
            nominal=data.nominal,
            metode_bayar=data.metode_bayar,
            catatan=data.catatan,
            created_by=user_id,
        )

        self.db.add(pembayaran)

        # Update piutang
        piutang.process_payment(data.nominal)

        # Update source transaction status if reference exists
        if piutang.referensi_id:
            if piutang.sumber == PiutangSource.BENGKEL:
                bengkel_trx = self.db.query(TransaksiPenjualanBengkel).filter(TransaksiPenjualanBengkel.id == piutang.referensi_id).first()
                if bengkel_trx:
                    bengkel_trx.jumlah_bayar += data.nominal
                    if piutang.status == PiutangStatus.LUNAS:
                        bengkel_trx.status_bayar = PaymentStatus.LUNAS
                        bengkel_trx.jumlah_bayar = bengkel_trx.grand_total # Correct any rounding/precision issues
                    else:
                        bengkel_trx.status_bayar = PaymentStatus.CICILAN

            elif piutang.sumber == PiutangSource.JASA_ANGKUT:
                muatan = self.db.query(MuatanJasaAngkut).filter(MuatanJasaAngkut.id == piutang.referensi_id).first()
                if muatan:
                    if piutang.status == PiutangStatus.LUNAS:
                        muatan.status_bayar = PaymentStatus.LUNAS
                        muatan.tanggal_bayar = data.tanggal
                        
                        # Also update linked internal Bengkel transaction if it exists
                        linked_bengkel = (
                            self.db.query(TransaksiPenjualanBengkel)
                            .filter(TransaksiPenjualanBengkel.catatan == f"Auto-generated from Jasa Angkut {muatan.nomor_transaksi}")
                            .first()
                        )
                        if linked_bengkel and linked_bengkel.status_bayar != PaymentStatus.LUNAS:
                            linked_bengkel.status_bayar = PaymentStatus.LUNAS
                            linked_bengkel.jumlah_bayar = linked_bengkel.grand_total

            elif piutang.sumber == PiutangSource.JUAL_BELI_MOBIL:
                mobil_trx = self.db.query(TransaksiPenjualanMobil).filter(TransaksiPenjualanMobil.id == piutang.referensi_id).first()
                if mobil_trx:
                    mobil_trx.dp += data.nominal
                    mobil_trx.sisa_bayar -= data.nominal
                    if piutang.status == PiutangStatus.LUNAS:
                        mobil_trx.status_bayar = PaymentStatus.LUNAS
                        mobil_trx.sisa_bayar = Decimal("0")
                    else:
                        mobil_trx.status_bayar = PaymentStatus.CICILAN

        self.db.commit()
        self.db.refresh(pembayaran)

        # Record payment to kas/bank
        create_kas_entry(
            db=self.db,
            tanggal=data.tanggal,
            tipe=KasBankType.MASUK,
            nominal=data.nominal,
            sumber=KasBankSource.PIUTANG,
            metode_bayar=data.metode_bayar,
            referensi_id=pembayaran.id,
            nomor_referensi=piutang.nomor_piutang,
            keterangan=f"Pembayaran piutang {piutang.nomor_piutang} - {piutang.nama_debitur}",
            user_id=user_id,
        )

        return pembayaran

    def delete(self, piutang_id: int) -> bool:
        """Delete receivable (only if no payments)."""
        piutang = self.get_by_id(piutang_id)

        if piutang.total_dibayar > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat menghapus piutang yang sudah ada pembayaran",
            )

        self.db.delete(piutang)
        self.db.commit()

        return True

    def get_summary(
        self,
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
    ) -> Dict[str, Any]:
        """Get receivables summary."""
        query = self.db.query(PiutangUsaha)

        if tanggal_dari:
            query = query.filter(PiutangUsaha.tanggal >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(PiutangUsaha.tanggal <= tanggal_sampai)

        # Aggregates
        aggregates = query.with_entities(
            func.sum(PiutangUsaha.nominal_piutang).label("total_piutang"),
            func.sum(PiutangUsaha.total_dibayar).label("total_terbayar"),
            func.sum(PiutangUsaha.sisa_piutang).label("total_sisa"),
        ).first()

        # Count by status
        lunas = query.filter(PiutangUsaha.status == PiutangStatus.LUNAS).count()
        belum_lunas = query.filter(
            PiutangUsaha.status != PiutangStatus.LUNAS
        ).count()
        overdue = query.filter(
            PiutangUsaha.tanggal_jatuh_tempo < date.today(),
            PiutangUsaha.status != PiutangStatus.LUNAS,
        ).count()

        # By source
        by_source = (
            query.with_entities(
                PiutangUsaha.sumber,
                func.count(PiutangUsaha.id).label("count"),
                func.sum(PiutangUsaha.sisa_piutang).label("sisa"),
            )
            .group_by(PiutangUsaha.sumber)
            .all()
        )

        source_summary = {}
        for row in by_source:
            source_summary[row.sumber.value] = {
                "count": row.count,
                "sisa_piutang": float(row.sisa or 0),
            }

        return {
            "total_piutang": float(aggregates.total_piutang or 0),
            "total_terbayar": float(aggregates.total_terbayar or 0),
            "total_sisa": float(aggregates.total_sisa or 0),
            "jumlah_lunas": lunas,
            "jumlah_belum_lunas": belum_lunas,
            "jumlah_overdue": overdue,
            "by_sumber": source_summary,
        }

    def get_overdue(self, limit: int = 20) -> List[PiutangUsaha]:
        """Get overdue receivables."""
        return (
            self.db.query(PiutangUsaha)
            .filter(
                PiutangUsaha.tanggal_jatuh_tempo < date.today(),
                PiutangUsaha.status != PiutangStatus.LUNAS,
            )
            .order_by(PiutangUsaha.tanggal_jatuh_tempo.asc())
            .limit(limit)
            .all()
        )

    def get_payment_history(self, piutang_id: int) -> List[PembayaranPiutang]:
        """Get payment history for a receivable."""
        return (
            self.db.query(PembayaranPiutang)
            .filter(PembayaranPiutang.piutang_id == piutang_id)
            .order_by(PembayaranPiutang.tanggal.desc())
            .all()
        )

    def get_by_customer(
        self,
        customer_id: int,
        unpaid_only: bool = True,
    ) -> List[PiutangUsaha]:
        """Get receivables for specific customer."""
        query = self.db.query(PiutangUsaha).filter(
            PiutangUsaha.customer_id == customer_id
        )

        if unpaid_only:
            query = query.filter(PiutangUsaha.status != PiutangStatus.LUNAS)

        return query.order_by(PiutangUsaha.tanggal.desc()).all()

    def get_customer_total(self, customer_id: int) -> Dict[str, Any]:
        """Get total receivables for customer."""
        result = (
            self.db.query(
                func.sum(PiutangUsaha.nominal_piutang).label("total"),
                func.sum(PiutangUsaha.sisa_piutang).label("sisa"),
            )
            .filter(
                PiutangUsaha.customer_id == customer_id,
                PiutangUsaha.status != PiutangStatus.LUNAS,
            )
            .first()
        )

        return {
            "total_piutang": float(result.total or 0),
            "sisa_piutang": float(result.sisa or 0),
        }
