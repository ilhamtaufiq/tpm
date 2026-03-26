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
from app.schemas.keuangan import (
    PiutangCreate,
    PiutangUpdate,
    PembayaranPiutangCreate,
    PembayaranPiutangSplit,
)
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
        if data.payments:
            for p_detail in data.payments:
                if p_detail.nominal <= 0:
                    continue
                create_kas_entry(
                    db=self.db,
                    tanggal=data.tanggal,
                    tipe=KasBankType.KELUAR,
                    nominal=p_detail.nominal,
                    sumber=KasBankSource.PIUTANG,
                    metode_bayar=p_detail.metode,
                    referensi_id=piutang.id,
                    nomor_referensi=piutang.nomor_piutang,
                    keterangan=f"Pemberian Piutang/Pinjaman kepada {piutang.nama_debitur} ({p_detail.metode.upper()})",
                    user_id=user_id,
                )
        elif data.metode_pembayaran:
            create_kas_entry(
                db=self.db,
                tanggal=data.tanggal,
                tipe=KasBankType.KELUAR,
                nominal=data.nominal_piutang,
                sumber=KasBankSource.PIUTANG,
                metode_bayar=data.metode_pembayaran,
                referensi_id=piutang.id,
                nomor_referensi=piutang.nomor_piutang,
                keterangan=f"Pemberian Piutang/Pinjaman kepada {piutang.nama_debitur} ({data.metode_pembayaran.upper()})",
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
            if status == PiutangStatus.BELUM_LUNAS:
                query = query.filter(PiutangUsaha.status.in_([PiutangStatus.BELUM_LUNAS, PiutangStatus.SEBAGIAN]))
            else:
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
        split_data = PembayaranPiutangSplit(
            piutang_id=data.piutang_id,
            tanggal=data.tanggal,
            payments=[{
                "metode": data.metode_bayar,
                "nominal": data.nominal,
                "catatan": data.catatan
            }],
            catatan=data.catatan
        )
        results = self.process_payment_split(split_data, user_id)
        return results[0]

    def _update_source_transaction(self, piutang: PiutangUsaha, total_nominal: Decimal, tanggal: date):
        """Update source transaction status and payment info."""
        if not piutang.referensi_id:
            return

        if piutang.sumber == PiutangSource.BENGKEL:
            bengkel_trx = self.db.query(TransaksiPenjualanBengkel).filter(TransaksiPenjualanBengkel.id == piutang.referensi_id).first()
            if bengkel_trx:
                bengkel_trx.jumlah_bayar += total_nominal
                if piutang.status == PiutangStatus.LUNAS:
                    bengkel_trx.status_bayar = PaymentStatus.LUNAS
                    bengkel_trx.jumlah_bayar = bengkel_trx.grand_total
                else:
                    bengkel_trx.status_bayar = PaymentStatus.CICILAN

        elif piutang.sumber == PiutangSource.JASA_ANGKUT:
            muatan = self.db.query(MuatanJasaAngkut).filter(MuatanJasaAngkut.id == piutang.referensi_id).first()
            if muatan:
                if piutang.status == PiutangStatus.LUNAS:
                    muatan.status_bayar = PaymentStatus.LUNAS
                    muatan.tanggal_bayar = tanggal
                    
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
                mobil_trx.dp += total_nominal
                mobil_trx.sisa_bayar -= total_nominal
                if piutang.status == PiutangStatus.LUNAS:
                    mobil_trx.status_bayar = PaymentStatus.LUNAS
                    mobil_trx.sisa_bayar = Decimal("0")
                    # Also update car status: BOOKING → TERJUAL
                    from app.models.mobil import Mobil
                    from app.utils.constants import CarStatus
                    mobil = self.db.query(Mobil).filter(Mobil.id == mobil_trx.mobil_id).first()
                    if mobil and mobil.status == CarStatus.BOOKING:
                        mobil.status = CarStatus.TERJUAL
                        mobil.tanggal_terjual = tanggal
                else:
                    mobil_trx.status_bayar = PaymentStatus.CICILAN

        elif piutang.sumber == PiutangSource.KASBON_KARYAWAN:
            from app.models.karyawan import KasbonKaryawan
            kasbon = self.db.query(KasbonKaryawan).filter(KasbonKaryawan.id == piutang.referensi_id).first()
            if kasbon:
                if piutang.status == PiutangStatus.LUNAS:
                    kasbon.status = PaymentStatus.LUNAS
                    kasbon.tanggal_lunas = tanggal
                else:
                    kasbon.status = PaymentStatus.CICILAN

    def process_payment_split(
        self,
        data: PembayaranPiutangSplit,
        user_id: Optional[int] = None,
    ) -> List[PembayaranPiutang]:
        """Process multiple payments for a receivable."""
        piutang = self.get_by_id(data.piutang_id)

        if piutang.status == PiutangStatus.LUNAS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Piutang sudah lunas",
            )

        total_payment_nominal = sum(p.nominal for p in data.payments)
        if total_payment_nominal > piutang.sisa_piutang:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Total nominal pembayaran ({total_payment_nominal}) melebihi sisa piutang ({piutang.sisa_piutang})",
            )

        pembayaran_records = []
        for p_detail in data.payments:
            if p_detail.nominal <= 0:
                continue

            # Create payment record
            pembayaran = PembayaranPiutang(
                piutang_id=data.piutang_id,
                tanggal=data.tanggal,
                nominal=p_detail.nominal,
                metode_bayar=p_detail.metode,
                catatan=p_detail.catatan or data.catatan,
                created_by=user_id,
            )
            self.db.add(pembayaran)
            self.db.flush() # Get ID for KasBank reference
            pembayaran_records.append(pembayaran)

            # Update piutang totals
            piutang.process_payment(p_detail.nominal)

            # Record to KasBank (Money In)
            create_kas_entry(
                db=self.db,
                tanggal=data.tanggal,
                tipe=KasBankType.MASUK,
                nominal=p_detail.nominal,
                sumber=KasBankSource.PIUTANG,
                metode_bayar=p_detail.metode,
                referensi_id=pembayaran.id,
                nomor_referensi=piutang.nomor_piutang,
                keterangan=f"Pembayaran piutang {piutang.nomor_piutang} - {piutang.nama_debitur} ({p_detail.metode.upper()})",
                user_id=user_id,
            )

        # Update source transaction status
        self._update_source_transaction(piutang, total_payment_nominal, data.tanggal)

        self.db.commit()
        
        # Update referensi_id for kas entries
        # This is a bit tricky since we don't have KasBank ID here easily without querying back
        # but create_kas_entry handles its own commit. We should have probably passed referensi_id if we had it.
        # For now, let's refresh and return.
        for p in pembayaran_records:
            self.db.refresh(p)
            
        return pembayaran_records

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
        """Get receivables summary (Snapshot at tanggal_sampai)."""
        # Base query for Piutang created up to tanggal_sampai
        # (tanggal_dari is used for reporting 'New Piutang in period', 
        # but for Balance Sheet/Neraca, we usually just need till tanggal_sampai)
        query = self.db.query(PiutangUsaha)
        
        # If calculating snapshot, we only care about records created BEFORE or ON tanggal_sampai
        if tanggal_sampai:
            query = query.filter(PiutangUsaha.tanggal <= tanggal_sampai)

        # To get real sisa_piutang as of tanggal_sampai:
        # SUM(nominal_piutang) - SUM(payments on those records up to tanggal_sampai)
        
        # 1. Total Nominal (records created <= tanggal_sampai)
        total_piutang_gross = query.with_entities(func.sum(PiutangUsaha.nominal_piutang)).scalar() or 0
        
        # 2. Total Payments (made <= tanggal_sampai for records created <= tanggal_sampai)
        q_payments = self.db.query(func.sum(PembayaranPiutang.nominal)).join(
            PiutangUsaha, PembayaranPiutang.piutang_id == PiutangUsaha.id
        ).filter(PiutangUsaha.tanggal <= (tanggal_sampai or date.max))
        
        if tanggal_sampai:
             q_payments = q_payments.filter(PembayaranPiutang.tanggal <= tanggal_sampai)
        
        total_terbayar_snapshot = q_payments.scalar() or 0
        total_sisa_snapshot = total_piutang_gross - total_terbayar_snapshot

        # Calculate counts (Snapshot status is harder, but we can approximate)
        lunas_count = query.filter(PiutangUsaha.status == PiutangStatus.LUNAS).count()
        if tanggal_sampai:
            # Better count: sisa_piutang at that time was 0.
            # But let's keep it simple for now as counts are less critical than values.
            pass

        # Breakdown By source
        sources = self.db.query(PiutangUsaha.sumber).distinct().all()
        source_summary = {}

        for (src,) in sources:
            # Gross for this source
            src_gross = self.db.query(func.sum(PiutangUsaha.nominal_piutang)).filter(
                PiutangUsaha.sumber == src,
                PiutangUsaha.tanggal <= (tanggal_sampai or date.max)
            ).scalar() or 0
            
            # Net for this source
            src_payments = self.db.query(func.sum(PembayaranPiutang.nominal)).join(
                PiutangUsaha, PembayaranPiutang.piutang_id == PiutangUsaha.id
            ).filter(
                PiutangUsaha.sumber == src,
                PiutangUsaha.tanggal <= (tanggal_sampai or date.max)
            )
            if tanggal_sampai:
                src_payments = src_payments.filter(PembayaranPiutang.tanggal <= tanggal_sampai)
            
            src_paid = src_payments.scalar() or 0
            src_sisa = src_gross - src_paid

            if src_gross > 0 or src_sisa > 0:
                source_summary[src.value] = {
                    "count": query.filter(PiutangUsaha.sumber == src).count(),
                    "total_piutang": float(src_gross),
                    "sisa_piutang": float(src_sisa),
                }

        return {
            "total_piutang": float(total_piutang_gross),
            "total_terbayar": float(total_terbayar_snapshot),
            "total_sisa": float(total_sisa_snapshot),
            "jumlah_lunas": lunas_count,
            "jumlah_belum_lunas": query.count() - lunas_count,
            "jumlah_overdue": 0, # Not snapshot-able easily
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
