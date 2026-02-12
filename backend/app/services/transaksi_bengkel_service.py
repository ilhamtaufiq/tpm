from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any, List

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from app.models.bengkel import (
    TransaksiPenjualanBengkel,
    DetailTransaksiSpareParts,
    DetailTransaksiServices,
    SparePart,
)
from app.models.customer import Customer
from app.models.keuangan import PiutangUsaha
from app.schemas.bengkel import TransaksiBengkelCreate
from app.utils.constants import (
    PaymentStatus,
    PaymentMethod,
    PiutangStatus,
    PiutangSource,
    TRANSACTION_PREFIXES,
    WorkshopStatus,
    KasBankType,
    KasBankSource,
)
from app.services.kas_bank_integration import create_kas_entry


class TransaksiBengkelService:
    """Service for workshop sales transactions."""

    def __init__(self, db: Session):
        self.db = db

    def _generate_nomor_transaksi(self) -> str:
        """Generate unique transaction number."""
        today = datetime.now()
        prefix = TRANSACTION_PREFIXES["bengkel"]
        date_str = today.strftime("%y%m%d")

        last = (
            self.db.query(TransaksiPenjualanBengkel)
            .filter(TransaksiPenjualanBengkel.nomor_transaksi.like(f"{prefix}{date_str}%"))
            .order_by(TransaksiPenjualanBengkel.id.desc())
            .first()
        )

        if last:
            last_num = int(last.nomor_transaksi[-4:])
            new_num = last_num + 1
        else:
            new_num = 1

        return f"{prefix}{date_str}{new_num:04d}"

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

    def _validate_customer(self, customer_id: int) -> Customer:
        """Validate customer exists."""
        customer = (
            self.db.query(Customer)
            .filter(
                Customer.id == customer_id,
                Customer.deleted_at.is_(None),
            )
            .first()
        )
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer tidak ditemukan",
            )
        return customer

    def _validate_spare_parts(
        self, detail_items: List[Any]
    ) -> Dict[int, SparePart]:
        """Validate spare parts and check stock availability."""
        if not detail_items:
            return {}

        spare_part_ids = [item.spare_part_id for item in detail_items]

        spare_parts = (
            self.db.query(SparePart)
            .filter(
                SparePart.id.in_(spare_part_ids),
                SparePart.deleted_at.is_(None),
            )
            .all()
        )

        found_ids = {sp.id for sp in spare_parts}
        missing_ids = set(spare_part_ids) - found_ids

        if missing_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Spare part dengan ID {missing_ids} tidak ditemukan",
            )

        # Check stock availability
        sp_map = {sp.id: sp for sp in spare_parts}
        for item in detail_items:
            sp = sp_map[item.spare_part_id]
            if sp.stok < item.qty:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Stok {sp.nama} tidak mencukupi. Tersedia: {sp.stok}, Diminta: {item.qty}",
                )

        return sp_map

    def create(
        self,
        data: TransaksiBengkelCreate,
        user_id: Optional[int] = None,
    ) -> TransaksiPenjualanBengkel:
        """Create a new workshop sales transaction."""
        # Validate customer if provided
        customer = None
        if data.customer_id:
            customer = self._validate_customer(data.customer_id)

        # Validate spare parts
        spare_parts_map = self._validate_spare_parts(data.detail_parts)

        # Generate transaction number
        nomor_transaksi = self._generate_nomor_transaksi()

        # Calculate parts total and HPP
        total_parts = Decimal("0")
        hpp_parts = Decimal("0")
        detail_parts_records = []

        for item in data.detail_parts:
            sp = spare_parts_map[item.spare_part_id]
            harga_jual = item.harga_jual if item.harga_jual else sp.harga_jual
            subtotal = harga_jual * item.qty
            total_parts += subtotal
            hpp_parts += sp.harga_beli * item.qty

            detail_parts_records.append(
                DetailTransaksiSpareParts(
                    spare_part_id=item.spare_part_id,
                    qty=item.qty,
                    harga_beli=sp.harga_beli,
                    harga_jual=harga_jual,
                    subtotal=subtotal,
                )
            )

        # Calculate services total
        total_jasa = Decimal("0")
        detail_services_records = []

        for item in data.detail_services:
            subtotal = item.harga * item.qty
            total_jasa += subtotal

            detail_services_records.append(
                DetailTransaksiServices(
                    nama_jasa=item.nama_jasa,
                    deskripsi=item.deskripsi,
                    harga=item.harga,
                    qty=item.qty,
                    subtotal=subtotal,
                )
            )

        # Calculate totals
        subtotal = total_parts + total_jasa
        grand_total = subtotal - data.diskon
        laba_kotor = grand_total - hpp_parts

        # Calculate summary of payments
        total_pembayaran = Decimal("0")
        metode_utama = data.metode_bayar
        
        if data.payments:
            total_pembayaran = sum(p.jumlah for p in data.payments)
            # If multiple methods used, set main method as SPLIT
            metodes = list(set(p.metode for p in data.payments if p.jumlah > 0))
            if len(metodes) > 1:
                metode_utama = PaymentMethod.SPLIT
            elif len(metodes) == 1:
                metode_utama = metodes[0]
        else:
            total_pembayaran = data.jumlah_bayar
            metode_utama = data.metode_bayar

        # Calculate payment status and change
        kembalian = Decimal("0")
        if total_pembayaran >= grand_total:
            kembalian = total_pembayaran - grand_total
            status_bayar = PaymentStatus.LUNAS
        elif total_pembayaran > 0:
            status_bayar = PaymentStatus.CICILAN
        else:
            status_bayar = PaymentStatus.BELUM_LUNAS

        # Customer name from customer record or input
        nama_customer = data.nama_customer
        if customer and not nama_customer:
            nama_customer = customer.nama

        # Create transaction record
        transaksi = TransaksiPenjualanBengkel(
            nomor_transaksi=nomor_transaksi,
            tanggal=data.tanggal,
            customer_id=data.customer_id,
            nama_customer=nama_customer,
            nomor_plat=data.nomor_plat,
            jenis_kendaraan=data.jenis_kendaraan,
            kategori=getattr(data, 'kategori', 'umum') or 'umum',
            muatan_id=getattr(data, 'muatan_id', None),
            mobil_id=getattr(data, 'mobil_id', None),
            total_parts=total_parts,
            total_jasa=total_jasa,
            subtotal=subtotal,
            diskon=data.diskon,
            grand_total=grand_total,
            hpp_parts=hpp_parts,
            laba_kotor=laba_kotor,
            status_bayar=status_bayar,
            metode_bayar=metode_utama,
            jumlah_bayar=total_pembayaran,
            kembalian=kembalian,
            catatan=data.catatan,
            created_by=user_id,
            detail_parts=detail_parts_records,
            detail_services=detail_services_records,
        )

        self.db.add(transaksi)

        # Reduce spare part stock
        for item in data.detail_parts:
            sp = spare_parts_map[item.spare_part_id]
            sp.stok -= item.qty

        # Create piutang if not fully paid
        if status_bayar != PaymentStatus.LUNAS and customer:
            piutang = PiutangUsaha(
                nomor_piutang=self._generate_nomor_piutang(),
                tanggal=data.tanggal,
                customer_id=customer.id,
                nama_debitur=customer.nama,
                telepon_debitur=customer.telepon,
                alamat_debitur=customer.alamat,
                sumber=PiutangSource.BENGKEL,
                referensi_id=None,  # Will update after commit
                nomor_referensi=nomor_transaksi,
                nominal_piutang=grand_total,
                sisa_piutang=max(grand_total - total_pembayaran, Decimal("0")),
                status=PiutangStatus.BELUM_LUNAS if total_pembayaran == 0 else PiutangStatus.SEBAGIAN,
                catatan=f"Piutang dari transaksi bengkel {nomor_transaksi}",
                created_by=user_id,
            )
            self.db.add(piutang)

        self.db.commit()
        self.db.refresh(transaksi)

        # Update piutang referensi_id
        if status_bayar != PaymentStatus.LUNAS and customer:
            piutang_record = (
                self.db.query(PiutangUsaha)
                .filter(PiutangUsaha.nomor_referensi == nomor_transaksi)
                .first()
            )
            if piutang_record:
                piutang_record.referensi_id = transaksi.id
                self.db.commit()

        # Record payment to kas/bank if any payment was made
        if data.payments:
            for p in data.payments:
                if p.jumlah > 0:
                    create_kas_entry(
                        db=self.db,
                        tanggal=data.tanggal,
                        tipe=KasBankType.MASUK,
                        nominal=p.jumlah,
                        sumber=KasBankSource.BENGKEL,
                        metode_bayar=p.metode,
                        referensi_id=transaksi.id,
                        nomor_referensi=transaksi.nomor_transaksi,
                        keterangan=f"Pembayaran ({p.metode.upper()}) bengkel {transaksi.nomor_transaksi}",
                        user_id=user_id,
                    )
        elif data.jumlah_bayar > 0:
            create_kas_entry(
                db=self.db,
                tanggal=data.tanggal,
                tipe=KasBankType.MASUK,
                nominal=data.jumlah_bayar,
                sumber=KasBankSource.BENGKEL,
                metode_bayar=data.metode_bayar,
                referensi_id=transaksi.id,
                nomor_referensi=transaksi.nomor_transaksi,
                keterangan=f"Pembayaran bengkel {transaksi.nomor_transaksi}",
                user_id=user_id,
            )

        return transaksi

    def get_by_id(self, transaksi_id: int) -> TransaksiPenjualanBengkel:
        """Get transaction by ID with details."""
        transaksi = (
            self.db.query(TransaksiPenjualanBengkel)
            .options(
                joinedload(TransaksiPenjualanBengkel.customer),
                joinedload(TransaksiPenjualanBengkel.detail_parts).joinedload(
                    DetailTransaksiSpareParts.spare_part
                ),
                joinedload(TransaksiPenjualanBengkel.detail_services),
            )
            .filter(TransaksiPenjualanBengkel.id == transaksi_id)
            .first()
        )
        if not transaksi:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaksi tidak ditemukan",
            )
        return transaksi

    def get_by_nomor(self, nomor_transaksi: str) -> Optional[TransaksiPenjualanBengkel]:
        """Get transaction by number."""
        return (
            self.db.query(TransaksiPenjualanBengkel)
            .options(
                joinedload(TransaksiPenjualanBengkel.customer),
                joinedload(TransaksiPenjualanBengkel.detail_parts),
                joinedload(TransaksiPenjualanBengkel.detail_services),
            )
            .filter(TransaksiPenjualanBengkel.nomor_transaksi == nomor_transaksi)
            .first()
        )

    def get_list(
        self,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        customer_id: Optional[int] = None,
        status_bayar: Optional[PaymentStatus] = None,
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
        sort_by: str = "tanggal",
        sort_order: str = "desc",
    ) -> Dict[str, Any]:
        """Get list of transactions with pagination and filters."""
        query = self.db.query(TransaksiPenjualanBengkel).options(
            joinedload(TransaksiPenjualanBengkel.customer),
            joinedload(TransaksiPenjualanBengkel.detail_parts).joinedload(DetailTransaksiSpareParts.spare_part),
            joinedload(TransaksiPenjualanBengkel.detail_services)
        )

        # Search filter
        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                or_(
                    TransaksiPenjualanBengkel.nomor_transaksi.ilike(search_filter),
                    TransaksiPenjualanBengkel.nama_customer.ilike(search_filter),
                    TransaksiPenjualanBengkel.nomor_plat.ilike(search_filter),
                )
            )

        # Customer filter
        if customer_id:
            query = query.filter(TransaksiPenjualanBengkel.customer_id == customer_id)

        # Payment status filter
        if status_bayar:
            query = query.filter(TransaksiPenjualanBengkel.status_bayar == status_bayar)

        # Date range filter
        if tanggal_dari:
            query = query.filter(TransaksiPenjualanBengkel.tanggal >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(TransaksiPenjualanBengkel.tanggal <= tanggal_sampai)

        # Count total
        total = query.count()

        # Sorting
        sort_column = getattr(
            TransaksiPenjualanBengkel, sort_by, TransaksiPenjualanBengkel.tanggal
        )
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        # Pagination
        transaksis = query.offset(skip).limit(limit).all()

        # Calculate pages
        pages = (total + limit - 1) // limit if limit > 0 else 1

        return {
            "data": transaksis,
            "total": total,
            "page": (skip // limit) + 1 if limit > 0 else 1,
            "size": limit,
            "pages": pages,
        }

    def get_summary(
        self,
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
    ) -> Dict[str, Any]:
        """Get sales summary statistics."""
        # Base query
        query = self.db.query(TransaksiPenjualanBengkel)

        if tanggal_dari:
            query = query.filter(TransaksiPenjualanBengkel.tanggal >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(TransaksiPenjualanBengkel.tanggal <= tanggal_sampai)

        # Total transactions (All)
        total_count = query.count()

        # Aggregate values (All transactions in period)
        aggregates = query.with_entities(
            func.sum(TransaksiPenjualanBengkel.grand_total).label("total_penjualan"),
            func.sum(TransaksiPenjualanBengkel.total_parts).label("total_parts"),
            func.sum(TransaksiPenjualanBengkel.total_jasa).label("total_jasa"),
            func.sum(TransaksiPenjualanBengkel.hpp_parts).label("total_hpp"),
            func.sum(TransaksiPenjualanBengkel.laba_kotor).label("total_laba"),
            func.sum(TransaksiPenjualanBengkel.diskon).label("total_diskon"),
        ).first()

        # Unpaid transactions (For Separated Stats)
        unpaid_query = query.filter(
            TransaksiPenjualanBengkel.status_bayar != PaymentStatus.LUNAS
        )
        unpaid_count = unpaid_query.count()
        unpaid_value = (
            unpaid_query.with_entities(
                func.sum(
                    TransaksiPenjualanBengkel.grand_total
                    - TransaksiPenjualanBengkel.jumlah_bayar
                )
            ).scalar()
            or Decimal("0")
        )

        # Status counts (Operational - Keep all)
        status_counts = (
            self.db.query(
                TransaksiPenjualanBengkel.status_pengerjaan,
                func.count(TransaksiPenjualanBengkel.id)
            )
            .group_by(TransaksiPenjualanBengkel.status_pengerjaan)
            .all()
        )
        status_map = {s.name.lower(): count for s, count in status_counts}

        return {
            "total_transaksi": total_count,
            "antre": status_map.get("antre", 0),
            "proses": status_map.get("proses", 0),
            "selesai": status_map.get("selesai", 0),
            "total_penjualan": float(aggregates.total_penjualan or 0),
            "total_parts": float(aggregates.total_parts or 0),
            "total_jasa": float(aggregates.total_jasa or 0),
            "total_diskon": float(aggregates.total_diskon or 0),
            "total_hpp": float(aggregates.total_hpp or 0),
            "total_laba_kotor": float(aggregates.total_laba or 0),
            "piutang_count": unpaid_count,
            "piutang_nilai": float(unpaid_value),
        }

    def get_daily_summary(self, tanggal: date) -> Dict[str, Any]:
        """Get daily sales summary."""
        query = self.db.query(TransaksiPenjualanBengkel).filter(
            TransaksiPenjualanBengkel.tanggal == tanggal
        )

        count = query.count()
        aggregates = query.with_entities(
            func.sum(TransaksiPenjualanBengkel.grand_total).label("total"),
            func.sum(TransaksiPenjualanBengkel.jumlah_bayar).label("total_bayar"),
            func.sum(TransaksiPenjualanBengkel.laba_kotor).label("laba"),
        ).first()

        return {
            "tanggal": tanggal.isoformat(),
            "jumlah_transaksi": count,
            "total_penjualan": float(aggregates.total or 0),
            "total_pembayaran": float(aggregates.total_bayar or 0),
            "laba_kotor": float(aggregates.laba or 0),
        }

    def update_payment(
        self,
        transaksi_id: int,
        jumlah_bayar: Decimal,
        metode_bayar: Optional[PaymentMethod] = None,
        user_id: Optional[int] = None,
    ) -> TransaksiPenjualanBengkel:
        """Update payment for a transaction."""
        transaksi = self.get_by_id(transaksi_id)

        if transaksi.status_bayar == PaymentStatus.LUNAS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transaksi sudah lunas",
            )

        # Update payment
        total_bayar = transaksi.jumlah_bayar + jumlah_bayar
        sisa = transaksi.grand_total - total_bayar

        if sisa <= 0:
            transaksi.status_bayar = PaymentStatus.LUNAS
            transaksi.kembalian = abs(sisa)
        else:
            transaksi.status_bayar = PaymentStatus.CICILAN

        transaksi.jumlah_bayar = total_bayar
        if metode_bayar:
            transaksi.metode_bayar = metode_bayar

        # Update piutang if exists
        piutang = (
            self.db.query(PiutangUsaha)
            .filter(
                PiutangUsaha.nomor_referensi == transaksi.nomor_transaksi,
                PiutangUsaha.sumber == PiutangSource.BENGKEL,
            )
            .first()
        )
        if piutang:
            piutang.sisa_piutang = max(sisa, Decimal("0"))
            if sisa <= 0:
                piutang.status = PiutangStatus.LUNAS
            else:
                piutang.status = PiutangStatus.SEBAGIAN

        self.db.commit()
        self.db.refresh(transaksi)

        # Record payment to kas/bank
        if jumlah_bayar > 0:
            payment_method = metode_bayar or transaksi.metode_bayar or PaymentMethod.TUNAI
            create_kas_entry(
                db=self.db,
                tanggal=date.today(),
                tipe=KasBankType.MASUK,
                nominal=jumlah_bayar,
                sumber=KasBankSource.BENGKEL,
                metode_bayar=payment_method,
                referensi_id=transaksi.id,
                nomor_referensi=transaksi.nomor_transaksi,
                keterangan=f"Pembayaran cicilan bengkel {transaksi.nomor_transaksi}",
                user_id=user_id,
            )

        return transaksi

    def update_status(
        self,
        transaksi_id: int,
        status: WorkshopStatus,
    ) -> TransaksiPenjualanBengkel:
        """Update working status for a transaction."""
        transaksi = self.get_by_id(transaksi_id)
        transaksi.status_pengerjaan = status
        
        self.db.commit()
        self.db.refresh(transaksi)
        
        return transaksi

    def void_transaction(self, transaksi_id: int) -> bool:
        """Void a transaction and restore stock.

        Note: Should only be used for recent transactions.
        """
        transaksi = self.get_by_id(transaksi_id)

        # Restore spare part stock
        for detail in transaksi.detail_parts:
            spare_part = (
                self.db.query(SparePart)
                .filter(SparePart.id == detail.spare_part_id)
                .first()
            )
            if spare_part:
                spare_part.stok += detail.qty

        # Delete related piutang
        self.db.query(PiutangUsaha).filter(
            PiutangUsaha.nomor_referensi == transaksi.nomor_transaksi,
            PiutangUsaha.sumber == PiutangSource.BENGKEL,
        ).delete()

        # Delete transaction (cascade will delete details)
        self.db.delete(transaksi)
        self.db.commit()

        return True

    def get_by_customer(
        self,
        customer_id: int,
        limit: int = 10,
    ) -> List[TransaksiPenjualanBengkel]:
        """Get recent transactions for a customer."""
        return (
            self.db.query(TransaksiPenjualanBengkel)
            .filter(TransaksiPenjualanBengkel.customer_id == customer_id)
            .order_by(TransaksiPenjualanBengkel.tanggal.desc())
            .limit(limit)
            .all()
        )
