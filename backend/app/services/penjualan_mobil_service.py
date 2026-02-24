from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any, List

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from app.models.mobil import Mobil, TransaksiPenjualanMobil, MobilBiayaLainnya
from app.models.customer import Customer
from app.models.keuangan import PiutangUsaha
from app.models.bengkel import (
    TransaksiPenjualanBengkel,
    DetailTransaksiSpareParts,
    DetailTransaksiServices,
    SparePart,
    WorkshopStatus,
)
from app.schemas.mobil import TransaksiMobilCreate
from app.utils.constants import (
    CarStatus,
    OwnershipType,
    PaymentStatus,
    PaymentMethod,
    PiutangStatus,
    PiutangSource,
    TRANSACTION_PREFIXES,
    KasBankType,
    KasBankSource,
)
from app.services.kas_bank_integration import create_kas_entry


class PenjualanMobilService:
    """Service for car sales transactions."""

    def __init__(self, db: Session):
        self.db = db

    def _generate_nomor_transaksi(self) -> str:
        """Generate unique transaction number."""
        today = datetime.now()
        prefix = TRANSACTION_PREFIXES["mobil"]
        date_str = today.strftime("%y%m%d")

        last = (
            self.db.query(TransaksiPenjualanMobil)
            .filter(TransaksiPenjualanMobil.nomor_transaksi.like(f"{prefix}{date_str}%"))
            .order_by(TransaksiPenjualanMobil.id.desc())
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

    def _generate_nomor_transaksi_bengkel(self) -> str:
        """Generate unique workshop transaction number."""
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

    def _validate_mobil(self, mobil_id: int) -> Mobil:
        """Validate car exists and is available for sale."""
        mobil = (
            self.db.query(Mobil)
            .options(
                joinedload(Mobil.biaya_lainnya),
                joinedload(Mobil.part_services),
            )
            .filter(
                Mobil.id == mobil_id,
                Mobil.deleted_at.is_(None),
            )
            .first()
        )
        if not mobil:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Mobil tidak ditemukan",
            )

        if mobil.status != CarStatus.TERSEDIA:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Mobil tidak tersedia untuk dijual (status: {mobil.status.value})",
            )

        return mobil

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

    def _calculate_profit_split(
        self,
        laba_kotor: Decimal,
        tipe_kepemilikan: OwnershipType,
        persentase_investor: Decimal,
        nominal_investor: Decimal = Decimal("0"),
        total_modal: Decimal = Decimal("0"),
    ) -> tuple[Decimal, Decimal]:
        """Calculate profit split between investor and TPM."""
        # If nominal investor is provided, calculate percentage based on modal
        effective_percentage = persentase_investor
        
        if nominal_investor > 0 and total_modal > 0:
            effective_percentage = (nominal_investor / total_modal) * 100
        elif tipe_kepemilikan == OwnershipType.TPM:
            return Decimal("0"), laba_kotor

        # Investor car: split profit based on percentage
        laba_investor = (laba_kotor * effective_percentage / 100).quantize(Decimal("0.01"))
        laba_tpm = laba_kotor - laba_investor

        return laba_investor, laba_tpm

    def create(
        self,
        data: TransaksiMobilCreate,
        user_id: Optional[int] = None,
    ) -> TransaksiPenjualanMobil:
        """Create a new car sales transaction."""
        # Validate car
        mobil = self._validate_mobil(data.mobil_id)

        # Validate customer if provided
        if data.customer_id:
            self._validate_customer(data.customer_id)

        # Generate transaction number
        nomor_transaksi = self._generate_nomor_transaksi()

        # 1. Process Operational Costs (Immediate)
        for cost_item in data.biaya_operasional:
            biaya = MobilBiayaLainnya(
                mobil_id=mobil.id,
                tanggal=data.tanggal,
                kategori="Operasional Penjualan",
                deskripsi=cost_item.deskripsi,
                jumlah=cost_item.jumlah,
                catatan=f"Ditambahkan saat penjualan {nomor_transaksi}"
            )
            self.db.add(biaya)

        # 2. Process Workshop Integration
        if hasattr(data, 'bengkel_items') and data.bengkel_items and (data.bengkel_items.parts or data.bengkel_items.services):
            no_trans_bengkel = self._generate_nomor_transaksi_bengkel()
            
            trans_bengkel = TransaksiPenjualanBengkel(
                nomor_transaksi=no_trans_bengkel,
                tanggal=data.tanggal,
                customer_id=None,
                nama_customer=f"Persiapan Jual: {mobil.merek} {mobil.model} ({mobil.nomor_plat})",
                nomor_plat=mobil.nomor_plat,
                jenis_kendaraan="Mobil",
                status_pengerjaan=WorkshopStatus.SELESAI,
                status_bayar=PaymentStatus.LUNAS, # Internal is always considered paid in this context
                metode_bayar=PaymentMethod.TUNAI, # Internal adjustment
                catatan=f"Otomatis dari Penjualan Mobil {nomor_transaksi}",
                created_by=user_id,
            )
            self.db.add(trans_bengkel)
            self.db.flush()

            total_parts = Decimal("0")
            hpp_parts = Decimal("0")
            
            for part_item in data.bengkel_items.parts:
                part = self.db.query(SparePart).filter(SparePart.id == part_item.part_id).first()
                if not part:
                    raise HTTPException(status_code=404, detail=f"Sparepart ID {part_item.part_id} tidak ditemukan")
                if part.stok < part_item.qty:
                    raise HTTPException(status_code=400, detail=f"Stok {part.nama} tidak cukup")
                
                part.stok -= part_item.qty
                subtotal = part.harga_jual * part_item.qty
                total_parts += subtotal
                hpp_parts += part.harga_beli * part_item.qty
                
                detail_part = DetailTransaksiSpareParts(
                    transaksi_id=trans_bengkel.id,
                    spare_part_id=part.id,
                    qty=part_item.qty,
                    harga_beli=part.harga_beli,
                    harga_jual=part.harga_jual,
                    subtotal=subtotal
                )
                self.db.add(detail_part)

            total_services = Decimal("0")
            for service_item in data.bengkel_items.services:
                subtotal = service_item.harga
                total_services += subtotal
                detail_service = DetailTransaksiServices(
                    transaksi_id=trans_bengkel.id,
                    nama_jasa=service_item.deskripsi,
                    deskripsi=service_item.deskripsi,
                    harga=service_item.harga,
                    qty=1,
                    subtotal=subtotal
                )
                self.db.add(detail_service)

            trans_bengkel.total_parts = total_parts
            trans_bengkel.total_jasa = total_services
            trans_bengkel.subtotal = total_parts + total_services
            trans_bengkel.grand_total = trans_bengkel.subtotal
            trans_bengkel.jumlah_bayar = trans_bengkel.grand_total
            trans_bengkel.hpp_parts = hpp_parts
            trans_bengkel.laba_kotor = trans_bengkel.grand_total - hpp_parts

            # Add to Car Costs
            biaya_bengkel = MobilBiayaLainnya(
                mobil_id=mobil.id,
                tanggal=data.tanggal,
                kategori="Perawatan Bengkel",
                deskripsi=f"Servis & Sparepart (Ref: {no_trans_bengkel})",
                jumlah=trans_bengkel.grand_total,
                catatan=f"Otomatis dari Penjualan {nomor_transaksi}"
            )
            self.db.add(biaya_bengkel)

        # Flush costs so they are included in total_modal calculation
        self.db.flush()
        self.db.refresh(mobil)

        # 3. Calculate totals (Now with updated costs)
        total_modal = mobil.total_modal
        laba_kotor = data.harga_jual - total_modal

        # Calculate profit split
        laba_investor, laba_tpm = self._calculate_profit_split(
            laba_kotor,
            mobil.tipe_kepemilikan,
            mobil.persentase_investor,
            mobil.nominal_investor,
            total_modal,
        )

        # Determine payment status
        sisa_bayar = data.harga_jual - data.dp
        if sisa_bayar <= 0:
            status_bayar = PaymentStatus.LUNAS
            sisa_bayar = Decimal("0")
        elif data.dp > 0:
            status_bayar = PaymentStatus.CICILAN
        else:
            status_bayar = PaymentStatus.BELUM_LUNAS

        # Create transaction
        transaksi = TransaksiPenjualanMobil(
            nomor_transaksi=nomor_transaksi,
            tanggal=data.tanggal,
            mobil_id=data.mobil_id,
            customer_id=data.customer_id,
            nama_pembeli=data.nama_pembeli,
            telepon_pembeli=data.telepon_pembeli,
            alamat_pembeli=data.alamat_pembeli,
            harga_jual=data.harga_jual,
            total_modal=total_modal,
            laba_kotor=laba_kotor,
            tipe_kepemilikan=mobil.tipe_kepemilikan,
            persentase_investor=mobil.persentase_investor,
            laba_investor=laba_investor,
            laba_tpm=laba_tpm,
            status_bayar=status_bayar,
            metode_bayar=data.metode_bayar,
            dp=data.dp,
            sisa_bayar=sisa_bayar,
            catatan=data.catatan,
            created_by=user_id,
        )

        self.db.add(transaksi)

        # Update car status based on payment
        if status_bayar == PaymentStatus.LUNAS:
            mobil.status = CarStatus.TERJUAL
            mobil.tanggal_terjual = data.tanggal
        else:
            mobil.status = CarStatus.BOOKING
        mobil.harga_jual = data.harga_jual

        # Create piutang if not fully paid (works with or without customer_id)
        if status_bayar != PaymentStatus.LUNAS:
            customer = None
            if data.customer_id:
                customer = self.db.query(Customer).get(data.customer_id)
            piutang = PiutangUsaha(
                nomor_piutang=self._generate_nomor_piutang(),
                tanggal=data.tanggal,
                customer_id=data.customer_id,
                nama_debitur=customer.nama if customer else data.nama_pembeli,
                telepon_debitur=customer.telepon if customer else data.telepon_pembeli,
                alamat_debitur=customer.alamat if customer else data.alamat_pembeli,
                sumber=PiutangSource.JUAL_BELI_MOBIL,
                referensi_id=None,  # Will update after commit
                nomor_referensi=nomor_transaksi,
                nominal_piutang=data.harga_jual,
                sisa_piutang=sisa_bayar,
                status=PiutangStatus.BELUM_LUNAS if data.dp == 0 else PiutangStatus.SEBAGIAN,
                catatan=f"Piutang penjualan mobil {mobil.merek} {mobil.model} ({mobil.nomor_plat})",
                created_by=user_id,
            )
            self.db.add(piutang)

        self.db.commit()
        self.db.refresh(transaksi)

        # Update piutang referensi_id
        if status_bayar != PaymentStatus.LUNAS:
            piutang_record = (
                self.db.query(PiutangUsaha)
                .filter(PiutangUsaha.nomor_referensi == nomor_transaksi)
                .first()
            )
            if piutang_record:
                piutang_record.referensi_id = transaksi.id
                self.db.commit()

        # Record DP payment to kas/bank if any
        if data.dp > 0:
            create_kas_entry(
                db=self.db,
                tanggal=data.tanggal,
                tipe=KasBankType.MASUK,
                nominal=data.dp,
                sumber=KasBankSource.JUAL_BELI_MOBIL,
                metode_bayar=data.metode_bayar,
                referensi_id=transaksi.id,
                nomor_referensi=transaksi.nomor_transaksi,
                keterangan=f"DP penjualan mobil {mobil.merek} {mobil.model} ({mobil.nomor_plat})",
                user_id=user_id,
            )

        return transaksi

    def get_by_id(self, transaksi_id: int) -> TransaksiPenjualanMobil:
        """Get transaction by ID."""
        transaksi = (
            self.db.query(TransaksiPenjualanMobil)
            .options(
                joinedload(TransaksiPenjualanMobil.mobil),
                joinedload(TransaksiPenjualanMobil.customer),
            )
            .filter(TransaksiPenjualanMobil.id == transaksi_id)
            .first()
        )
        if not transaksi:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaksi tidak ditemukan",
            )
        
        # Add piutang_id to the response
        piutang = (
            self.db.query(PiutangUsaha.id, PiutangUsaha.sisa_piutang)
            .filter(
                PiutangUsaha.nomor_referensi == transaksi.nomor_transaksi,
                PiutangUsaha.sumber == PiutangSource.JUAL_BELI_MOBIL
            )
            .first()
        )
        if piutang:
            transaksi.piutang_id = piutang.id
            # Sync sisa_bayar with latest piutang status
            transaksi.sisa_bayar = piutang.sisa_piutang

        return transaksi

    def get_by_nomor(self, nomor_transaksi: str) -> Optional[TransaksiPenjualanMobil]:
        """Get transaction by number."""
        return (
            self.db.query(TransaksiPenjualanMobil)
            .options(
                joinedload(TransaksiPenjualanMobil.mobil),
                joinedload(TransaksiPenjualanMobil.customer),
            )
            .filter(TransaksiPenjualanMobil.nomor_transaksi == nomor_transaksi)
            .first()
        )

    def get_list(
        self,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        customer_id: Optional[int] = None,
        status_bayar: Optional[PaymentStatus] = None,
        tipe_kepemilikan: Optional[OwnershipType] = None,
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
        sort_by: str = "tanggal",
        sort_order: str = "desc",
    ) -> Dict[str, Any]:
        """Get list of transactions with pagination and filters."""
        query = self.db.query(TransaksiPenjualanMobil).options(
            joinedload(TransaksiPenjualanMobil.mobil),
            joinedload(TransaksiPenjualanMobil.customer),
        )

        # Search filter
        if search:
            search_filter = f"%{search}%"
            query = query.join(TransaksiPenjualanMobil.mobil).filter(
                or_(
                    TransaksiPenjualanMobil.nomor_transaksi.ilike(search_filter),
                    TransaksiPenjualanMobil.nama_pembeli.ilike(search_filter),
                    Mobil.nomor_plat.ilike(search_filter),
                    Mobil.merek.ilike(search_filter),
                )
            )

        # Customer filter
        if customer_id:
            query = query.filter(TransaksiPenjualanMobil.customer_id == customer_id)

        # Payment status filter
        if status_bayar:
            query = query.filter(TransaksiPenjualanMobil.status_bayar == status_bayar)

        # Ownership filter
        if tipe_kepemilikan:
            query = query.filter(
                TransaksiPenjualanMobil.tipe_kepemilikan == tipe_kepemilikan
            )

        # Date range filter
        if tanggal_dari:
            query = query.filter(TransaksiPenjualanMobil.tanggal >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(TransaksiPenjualanMobil.tanggal <= tanggal_sampai)

        # Count total
        total = query.count()

        # Sorting
        sort_column = getattr(
            TransaksiPenjualanMobil, sort_by, TransaksiPenjualanMobil.tanggal
        )
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        # Pagination
        transaksis = query.offset(skip).limit(limit).all()

        # Batch fetch piutang info
        if transaksis:
            nomor_refs = [t.nomor_transaksi for t in transaksis]
            piutang_info = self.db.query(
                PiutangUsaha.id, PiutangUsaha.nomor_referensi, PiutangUsaha.sisa_piutang
            ).filter(
                PiutangUsaha.nomor_referensi.in_(nomor_refs),
                PiutangUsaha.sumber == PiutangSource.JUAL_BELI_MOBIL
            ).all()
            
            piutang_map = {p.nomor_referensi: (p.id, p.sisa_piutang) for p in piutang_info}
            
            for t in transaksis:
                info = piutang_map.get(t.nomor_transaksi)
                if info:
                    t.piutang_id, t.sisa_bayar = info

        # Calculate pages
        pages = (total + limit - 1) // limit if limit > 0 else 1

        return {
            "data": transaksis,
            "total": total,
            "page": (skip // limit) + 1 if limit > 0 else 1,
            "size": limit,
            "pages": pages,
        }

    def update_payment(
        self,
        transaksi_id: int,
        jumlah_bayar: Decimal,
        payments: List[tuple[PaymentMethod, Decimal]],
        user_id: Optional[int] = None,
    ) -> TransaksiPenjualanMobil:
        """Process payment for transaction (supports split payments)."""
        transaksi = self.get_by_id(transaksi_id)

        if transaksi.status_bayar == PaymentStatus.LUNAS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transaksi sudah lunas",
            )

        # Update payment
        transaksi.dp += jumlah_bayar
        transaksi.sisa_bayar -= jumlah_bayar

        if transaksi.sisa_bayar <= 0:
            transaksi.status_bayar = PaymentStatus.LUNAS
            transaksi.sisa_bayar = Decimal("0")
        else:
            transaksi.status_bayar = PaymentStatus.CICILAN

        # Update piutang if exists
        piutang = (
            self.db.query(PiutangUsaha)
            .filter(
                PiutangUsaha.nomor_referensi == transaksi.nomor_transaksi,
                PiutangUsaha.sumber == PiutangSource.JUAL_BELI_MOBIL,
            )
            .first()
        )
        if piutang:
            piutang.sisa_piutang = transaksi.sisa_bayar
            if transaksi.status_bayar == PaymentStatus.LUNAS:
                piutang.status = PiutangStatus.LUNAS
            else:
                piutang.status = PiutangStatus.SEBAGIAN

        # Update car status: BOOKING → TERJUAL when fully paid
        if transaksi.status_bayar == PaymentStatus.LUNAS:
            mobil = self.db.query(Mobil).filter(Mobil.id == transaksi.mobil_id).first()
            if mobil and mobil.status == CarStatus.BOOKING:
                mobil.status = CarStatus.TERJUAL
                mobil.tanggal_terjual = date.today()

        self.db.commit()
        self.db.refresh(transaksi)

        # Record payment to kas/bank
        for metode, nominal in payments:
            if nominal > 0:
                create_kas_entry(
                    db=self.db,
                    tanggal=date.today(),
                    tipe=KasBankType.MASUK,
                    nominal=nominal,
                    sumber=KasBankSource.JUAL_BELI_MOBIL,
                    metode_bayar=metode,
                    referensi_id=transaksi.id,
                    nomor_referensi=transaksi.nomor_transaksi,
                    keterangan=f"Pembayaran cicilan mobil {transaksi.nomor_transaksi} ({metode})",
                    user_id=user_id,
                )

        return transaksi

    def cancel_booking(
        self,
        transaksi_id: int,
        penalti: Decimal = Decimal("0"),
        refund_entries: List[tuple[PaymentMethod, Optional[Decimal]]] = None,
        alasan: str = "",
        user_id: Optional[int] = None,
    ) -> TransaksiPenjualanMobil:
        """Cancel a booking and process penalty/refund (supports split refund)."""
        transaksi = self.get_by_id(transaksi_id)

        # Validate: must be a non-LUNAS booking
        if transaksi.status_bayar == PaymentStatus.LUNAS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transaksi sudah lunas, tidak bisa dibatalkan",
            )

        mobil = self.db.query(Mobil).filter(Mobil.id == transaksi.mobil_id).first()
        if not mobil or mobil.status != CarStatus.BOOKING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mobil tidak dalam status BOOKING",
            )

        dp_terbayar = transaksi.dp
        if penalti > dp_terbayar:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Penalti ({penalti}) tidak boleh melebihi DP terbayar ({dp_terbayar})",
            )

        refund = dp_terbayar - penalti

        # 1. Revert car status to TERSEDIA
        mobil.status = CarStatus.TERSEDIA
        mobil.tanggal_terjual = None

        # 2. Mark transaction as cancelled
        transaksi.status_bayar = PaymentStatus.BELUM_LUNAS
        catatan_batal = f"DIBATALKAN - Penalti: {penalti}, Refund: {refund}"
        if alasan:
            catatan_batal += f" | Alasan: {alasan}"
        transaksi.catatan = catatan_batal
        transaksi.sisa_bayar = transaksi.harga_jual  # Reset sisa

        # 3. Close piutang (mark as LUNAS with 0 sisa since booking is cancelled)
        piutang = (
            self.db.query(PiutangUsaha)
            .filter(
                PiutangUsaha.nomor_referensi == transaksi.nomor_transaksi,
                PiutangUsaha.sumber == PiutangSource.JUAL_BELI_MOBIL,
            )
            .first()
        )
        if piutang:
            piutang.status = PiutangStatus.LUNAS
            piutang.sisa_piutang = Decimal("0")
            piutang.catatan = f"Piutang ditutup - Booking dibatalkan. {catatan_batal}"

        self.db.commit()
        self.db.refresh(transaksi)

        # 4. Record penalty as income (if > 0)
        if penalti > 0:
            create_kas_entry(
                db=self.db,
                tanggal=date.today(),
                tipe=KasBankType.MASUK,
                nominal=penalti,
                sumber=KasBankSource.JUAL_BELI_MOBIL,
                metode_bayar=PaymentMethod.TUNAI,  # penalty kept in cash
                referensi_id=transaksi.id,
                nomor_referensi=transaksi.nomor_transaksi,
                keterangan=f"Penalti pembatalan booking mobil {transaksi.nomor_transaksi}",
                user_id=user_id,
            )

        # 5. Record refund as expense (if > 0)
        if refund > 0:
            if not refund_entries:
                # Fallback to cash if no entries provided
                refund_entries = [(PaymentMethod.TUNAI, refund)]
            
            # If any entry has None as nominal, it means it's the only entry or we use the calculated refund
            prepared_refunds = []
            for metode, nominal in refund_entries:
                if nominal is None:
                    prepared_refunds.append((metode, refund))
                else:
                    prepared_refunds.append((metode, nominal))
            
            # Validate total refund matches
            total_refund_input = sum(n for m, n in prepared_refunds)
            if total_refund_input != refund:
                 raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Total nominal refund ({total_refund_input}) tidak sesuai dengan sisa DP ({refund})",
                )

            for metode, nominal in prepared_refunds:
                if nominal > 0:
                    create_kas_entry(
                        db=self.db,
                        tanggal=date.today(),
                        tipe=KasBankType.KELUAR,
                        nominal=nominal,
                        sumber=KasBankSource.JUAL_BELI_MOBIL,
                        metode_bayar=metode,
                        referensi_id=transaksi.id,
                        nomor_referensi=transaksi.nomor_transaksi,
                        keterangan=f"Refund pembatalan booking mobil {transaksi.nomor_transaksi} kepada {transaksi.nama_pembeli} ({metode})",
                        user_id=user_id,
                    )

        return transaksi

    def get_summary(
        self,
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
    ) -> Dict[str, Any]:
        """Get sales summary statistics."""
        # Base query (All)
        query = self.db.query(TransaksiPenjualanMobil)

        if tanggal_dari:
            query = query.filter(TransaksiPenjualanMobil.tanggal >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(TransaksiPenjualanMobil.tanggal <= tanggal_sampai)

        # Total transactions (All)
        total_count = query.count()

        # Aggregate values (All transactions in period)
        aggregates = query.with_entities(
            func.sum(TransaksiPenjualanMobil.harga_jual).label("total_penjualan"),
            func.sum(TransaksiPenjualanMobil.total_modal).label("total_modal"),
            func.sum(TransaksiPenjualanMobil.laba_kotor).label("total_laba_kotor"),
            func.sum(TransaksiPenjualanMobil.laba_investor).label("total_laba_investor"),
            func.sum(TransaksiPenjualanMobil.laba_tpm).label("total_laba_tpm"),
            func.sum(TransaksiPenjualanMobil.dp).label("total_dp"),
        ).first()

        # By ownership type
        by_ownership = (
            query.with_entities(
                TransaksiPenjualanMobil.tipe_kepemilikan,
                func.count(TransaksiPenjualanMobil.id).label("count"),
                func.sum(TransaksiPenjualanMobil.harga_jual).label("total"),
                func.sum(TransaksiPenjualanMobil.laba_kotor).label("laba"),
            )
            .group_by(TransaksiPenjualanMobil.tipe_kepemilikan)
            .all()
        )

        ownership_summary = {}
        for row in by_ownership:
            ownership_summary[row.tipe_kepemilikan.value] = {
                "count": row.count,
                "total_penjualan": float(row.total or 0),
                "laba_kotor": float(row.laba or 0),
            }

        # Unpaid transactions (Still keep for separation if needed)
        unpaid_query = query.filter(
            TransaksiPenjualanMobil.status_bayar != PaymentStatus.LUNAS
        )
        unpaid_count = unpaid_query.count()
        unpaid_value = (
            unpaid_query.with_entities(
                func.sum(TransaksiPenjualanMobil.sisa_bayar)
            ).scalar()
            or Decimal("0")
        )

        return {
            "total_transaksi": total_count,
            "total_penjualan": float(aggregates.total_penjualan or 0),
            "total_modal": float(aggregates.total_modal or 0),
            "total_laba_kotor": float(aggregates.total_laba_kotor or 0),
            "laba_investor": float(aggregates.total_laba_investor or 0),
            "laba_tpm": float(aggregates.total_laba_tpm or 0),
            "total_dp": float(aggregates.total_dp or 0),
            "per_kepemilikan": ownership_summary,
            "piutang_count": unpaid_count,
            "piutang_nilai": float(unpaid_value),
        }

    def get_investor_report(
        self,
        nama_investor: Optional[str] = None,
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
    ) -> List[Dict[str, Any]]:
        """Get investor profit report."""
        query = (
            self.db.query(TransaksiPenjualanMobil)
            .join(TransaksiPenjualanMobil.mobil)
            .filter(TransaksiPenjualanMobil.tipe_kepemilikan == OwnershipType.INVESTOR)
        )

        if nama_investor:
            query = query.filter(Mobil.nama_investor.ilike(f"%{nama_investor}%"))
        if tanggal_dari:
            query = query.filter(TransaksiPenjualanMobil.tanggal >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(TransaksiPenjualanMobil.tanggal <= tanggal_sampai)

        transaksis = query.order_by(TransaksiPenjualanMobil.tanggal.desc()).all()

        return [
            {
                "tanggal": t.tanggal.isoformat(),
                "nomor_transaksi": t.nomor_transaksi,
                "mobil": f"{t.mobil.merek} {t.mobil.model} ({t.mobil.nomor_plat})",
                "nama_investor": t.mobil.nama_investor,
                "harga_beli": float(t.mobil.harga_beli),
                "harga_jual": float(t.harga_jual),
                "total_modal": float(t.total_modal),
                "laba_kotor": float(t.laba_kotor),
                "persentase_investor": float(t.persentase_investor),
                "laba_investor": float(t.laba_investor),
                "laba_tpm": float(t.laba_tpm),
            }
            for t in transaksis
        ]
