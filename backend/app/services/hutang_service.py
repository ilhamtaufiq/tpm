from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any, List

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from app.models.keuangan import HutangUsaha, PembayaranHutang
from app.models.supplier import Supplier
from app.models.bengkel import PembelianSparePart
from app.models.mobil import Mobil
from app.schemas.keuangan import (
    HutangCreate,
    HutangUpdate,
    PembayaranHutangCreate,
    PembayaranHutangSplit,
)
from app.utils.constants import (
    HutangStatus,
    HutangSource,
    PaymentMethod,
    PaymentStatus,
    TRANSACTION_PREFIXES,
    KasBankType,
    KasBankSource,
)
from app.services.kas_bank_integration import create_kas_entry


class HutangService:
    """Service for accounts payable management."""

    def __init__(self, db: Session):
        self.db = db

    def _generate_nomor_hutang(self) -> str:
        """Generate unique payable number."""
        today = datetime.now()
        prefix = TRANSACTION_PREFIXES["hutang"]
        date_str = today.strftime("%y%m%d")

        last = (
            self.db.query(HutangUsaha)
            .filter(HutangUsaha.nomor_hutang.like(f"{prefix}{date_str}%"))
            .order_by(HutangUsaha.id.desc())
            .first()
        )

        if last:
            last_num = int(last.nomor_hutang[-4:])
            new_num = last_num + 1
        else:
            new_num = 1

        return f"{prefix}{date_str}{new_num:04d}"

    def create(
        self,
        data: HutangCreate,
        user_id: Optional[int] = None,
    ) -> HutangUsaha:
        """Create a new payable record."""
        # Generate number
        nomor_hutang = self._generate_nomor_hutang()

        hutang = HutangUsaha(
            nomor_hutang=nomor_hutang,
            tanggal=data.tanggal,
            sumber=data.sumber,
            referensi_id=data.referensi_id,
            nomor_referensi=data.nomor_referensi,
            supplier_id=data.supplier_id,
            nama_kreditur=data.nama_kreditur,
            telepon_kreditur=data.telepon_kreditur,
            alamat_kreditur=data.alamat_kreditur,
            nominal_hutang=data.nominal_hutang,
            total_dibayar=Decimal("0"),
            sisa_hutang=data.nominal_hutang,
            tanggal_jatuh_tempo=data.tanggal_jatuh_tempo,
            status=HutangStatus.BELUM_LUNAS,
            catatan=data.catatan,
            created_by=user_id,
        )

        self.db.add(hutang)
        self.db.commit()
        self.db.refresh(hutang)

        # If manual hutang creation involves cash inflow (e.g. borrowing money)
        if data.payments:
            for p_detail in data.payments:
                if p_detail.nominal <= 0:
                    continue
                create_kas_entry(
                    db=self.db,
                    tanggal=data.tanggal,
                    tipe=KasBankType.MASUK,
                    nominal=p_detail.nominal,
                    sumber=KasBankSource.HUTANG,
                    metode_bayar=p_detail.metode,
                    referensi_id=hutang.id,
                    nomor_referensi=hutang.nomor_hutang,
                    keterangan=f"Penerimaan Pinjaman/Hutang dari {hutang.nama_kreditur} ({p_detail.metode.upper()})",
                    user_id=user_id,
                )
        elif data.metode_pembayaran:
            create_kas_entry(
                db=self.db,
                tanggal=data.tanggal,
                tipe=KasBankType.MASUK,
                nominal=data.nominal_hutang,
                sumber=KasBankSource.HUTANG,
                metode_bayar=data.metode_pembayaran,
                referensi_id=hutang.id,
                nomor_referensi=hutang.nomor_hutang,
                keterangan=f"Penerimaan Pinjaman/Hutang dari {hutang.nama_kreditur} ({data.metode_pembayaran.upper()})",
                user_id=user_id,
            )

        return hutang

    def get_by_id(self, hutang_id: int) -> HutangUsaha:
        """Get payable by ID."""
        hutang = (
            self.db.query(HutangUsaha)
            .options(joinedload(HutangUsaha.pembayaran))
            .filter(HutangUsaha.id == hutang_id)
            .first()
        )
        if not hutang:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Hutang tidak ditemukan",
            )
        return hutang

    def get_list(
        self,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        supplier_id: Optional[int] = None,
        sumber: Optional[HutangSource] = None,
        status: Optional[HutangStatus] = None,
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
        sort_by: str = "tanggal",
        sort_order: str = "desc",
    ) -> Dict[str, Any]:
        """Get list of payables with pagination and filters."""
        query = self.db.query(HutangUsaha).options(
            joinedload(HutangUsaha.pembayaran)
        )

        # Search filter
        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                or_(
                    HutangUsaha.nomor_hutang.ilike(search_filter),
                    HutangUsaha.nama_kreditur.ilike(search_filter),
                    HutangUsaha.nomor_referensi.ilike(search_filter),
                )
            )

        # Supplier filter
        if supplier_id:
            query = query.filter(HutangUsaha.supplier_id == supplier_id)

        # Source filter
        if sumber:
            query = query.filter(HutangUsaha.sumber == sumber)

        # Status filter
        if status:
            query = query.filter(HutangUsaha.status == status)

        # Date range filter
        if tanggal_dari:
            query = query.filter(HutangUsaha.tanggal >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(HutangUsaha.tanggal <= tanggal_sampai)

        # Count total
        total = query.count()

        # Aggregates for summary
        aggregates = query.with_entities(
            func.sum(HutangUsaha.nominal_hutang).label("total_hutang"),
            func.sum(HutangUsaha.total_dibayar).label("total_terbayar"),
            func.sum(HutangUsaha.sisa_hutang).label("total_sisa"),
        ).first()

        # Sorting
        sort_column = getattr(HutangUsaha, sort_by, HutangUsaha.tanggal)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        # Pagination
        hutangs = query.offset(skip).limit(limit).all()

        # Calculate pages
        pages = (total + limit - 1) // limit if limit > 0 else 1

        return {
            "data": hutangs,
            "total": total,
            "page": (skip // limit) + 1 if limit > 0 else 1,
            "size": limit,
            "pages": pages,
            "total_hutang": float(aggregates.total_hutang or 0),
            "total_terbayar": float(aggregates.total_terbayar or 0),
            "total_sisa": float(aggregates.total_sisa or 0),
        }

    def process_payment(
        self,
        data: PembayaranHutangCreate,
        user_id: Optional[int] = None,
    ) -> PembayaranHutang:
        """Process payment for payable."""
        split_data = PembayaranHutangSplit(
            hutang_id=data.hutang_id,
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

    def _update_source_transaction(self, hutang: HutangUsaha, total_nominal: Decimal, tanggal: date):
        """Update source transaction status and payment info."""
        if not hutang.referensi_id:
            return

        if hutang.sumber == HutangSource.PEMBELIAN_PART:
            pembelian = self.db.query(PembelianSparePart).filter(PembelianSparePart.id == hutang.referensi_id).first()
            if pembelian:
                # In PembelianSparePart, we don't have cumulative payment field yet, 
                # but we can check if it's now LUNAS
                if hutang.status == HutangStatus.LUNAS:
                    pembelian.status_bayar = PaymentStatus.LUNAS
                    pembelian.tanggal_bayar = tanggal

        elif hutang.sumber == HutangSource.PEMBELIAN_MOBIL:
            mobil = self.db.query(Mobil).filter(Mobil.id == hutang.referensi_id).first()
            if mobil:
                mobil.dp_beli += total_nominal
                if hutang.status == HutangStatus.LUNAS:
                    mobil.status_bayar_beli = PaymentStatus.LUNAS
                else:
                    mobil.status_bayar_beli = PaymentStatus.CICILAN

    def process_payment_split(
        self,
        data: PembayaranHutangSplit,
        user_id: Optional[int] = None,
    ) -> List[PembayaranHutang]:
        """Process multiple payments for a payable."""
        hutang = self.get_by_id(data.hutang_id)

        if hutang.status == HutangStatus.LUNAS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Hutang sudah lunas",
            )

        total_payment_nominal = sum(p.nominal for p in data.payments)
        if total_payment_nominal > hutang.sisa_hutang:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Total nominal pembayaran ({total_payment_nominal}) melebihi sisa hutang ({hutang.sisa_hutang})",
            )

        pembayaran_records = []
        for p_detail in data.payments:
            if p_detail.nominal <= 0:
                continue

            # Create payment record
            pembayaran = PembayaranHutang(
                hutang_id=data.hutang_id,
                tanggal=data.tanggal,
                nominal=p_detail.nominal,
                metode_bayar=p_detail.metode,
                catatan=p_detail.catatan or data.catatan,
                created_by=user_id,
            )
            self.db.add(pembayaran)
            self.db.flush() # Get ID for KasBank reference
            pembayaran_records.append(pembayaran)

            # Update hutang totals
            hutang.process_payment(p_detail.nominal)

            # Record to KasBank (Money Out)
            create_kas_entry(
                db=self.db,
                tanggal=data.tanggal,
                tipe=KasBankType.KELUAR,
                nominal=p_detail.nominal,
                sumber=KasBankSource.HUTANG,
                metode_bayar=p_detail.metode,
                referensi_id=pembayaran.id,
                nomor_referensi=hutang.nomor_hutang,
                keterangan=f"Pembayaran hutang {hutang.nomor_hutang} - {hutang.nama_kreditur} ({p_detail.metode.upper()})",
                user_id=user_id,
            )

        # Update source transaction status
        self._update_source_transaction(hutang, total_payment_nominal, data.tanggal)

        self.db.commit()
        
        for p in pembayaran_records:
            self.db.refresh(p)
            
        return pembayaran_records

    def get_summary(
        self,
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
    ) -> Dict[str, Any]:
        """Get payables summary."""
        query = self.db.query(HutangUsaha)

        if tanggal_dari:
            query = query.filter(HutangUsaha.tanggal >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(HutangUsaha.tanggal <= tanggal_sampai)

        # Aggregates
        aggregates = query.with_entities(
            func.sum(HutangUsaha.nominal_hutang).label("total_hutang"),
            func.sum(HutangUsaha.total_dibayar).label("total_terbayar"),
            func.sum(HutangUsaha.sisa_hutang).label("total_sisa"),
        ).first()

        # Count by status
        lunas = query.filter(HutangUsaha.status == HutangStatus.LUNAS).count()
        belum_lunas = query.filter(
            HutangUsaha.status != HutangStatus.LUNAS
        ).count()

        # By source
        by_source = (
            query.with_entities(
                HutangUsaha.sumber,
                func.count(HutangUsaha.id).label("count"),
                func.sum(HutangUsaha.sisa_hutang).label("sisa"),
            )
            .group_by(HutangUsaha.sumber)
            .all()
        )

        source_summary = {}
        for row in by_source:
            source_summary[row.sumber.value] = {
                "count": row.count,
                "sisa_hutang": float(row.sisa or 0),
            }

        return {
            "total_hutang": float(aggregates.total_hutang or 0),
            "total_terbayar": float(aggregates.total_terbayar or 0),
            "total_sisa": float(aggregates.total_sisa or 0),
            "jumlah_lunas": lunas,
            "jumlah_belum_lunas": belum_lunas,
            "by_sumber": source_summary,
        }
