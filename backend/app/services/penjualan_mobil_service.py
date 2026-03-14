from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any, List

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from app.models.mobil import Mobil, TransaksiPenjualanMobil, MobilBiayaLainnya, InvestorDisbursementDetail
from app.models.customer import Customer
from app.models.keuangan import PiutangUsaha, HutangUsaha, HutangStatus, HutangSource
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
    InvestorDisbursementStatus,
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
                joinedload(Mobil.bengkel_perbaikan),
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
        if tipe_kepemilikan == OwnershipType.TPM:
            return Decimal("0"), laba_kotor

        # If nominal investor is provided, calculate effective percentage based on modal
        # Example: if baseline is 40% and they fund 100% of (HPP + PartService), they get 40%
        # If they fund 50%, they get (50/100) * 40% = 20%
        effective_percentage = persentase_investor
        
        if nominal_investor > 0 and total_modal > 0:
            funding_ratio = nominal_investor / total_modal
            effective_percentage = (persentase_investor * funding_ratio)
        elif nominal_investor > 0:
            # Fallback if total_modal is somehow 0 (shouldn't happen with buy price)
            effective_percentage = persentase_investor

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
            trans_bengkel.kategori = 'jual_beli_mobil'
            trans_bengkel.mobil_id = mobil.id

        # Flush costs so they are included in totals calculation
        self.db.flush()
        self.db.refresh(mobil)

        # 3. Calculate totals based on new HPP rules
        # HPP Accounting = Harga Beli + Pengeluaran (Non-Bengkel)
        hpp_accounting = mobil.hpp
        
        # total_part_service = cumulative Part & Service costs
        total_part_service = mobil.total_part_service
        
        # Real Modal (Investment) for profit split calculations
        # nominal investor should be compared against this
        real_total_modal = hpp_accounting + total_part_service
        
        # Laba Kotor = Harga Jual - HPP_Accounting - Part_Service
        laba_kotor = data.harga_jual - hpp_accounting - total_part_service

        # Calculate profit split using real_total_modal as base
        laba_investor, laba_tpm = self._calculate_profit_split(
            laba_kotor,
            mobil.tipe_kepemilikan,
            mobil.persentase_investor,
            mobil.nominal_investor,
            real_total_modal, # Use total investment including parts
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
            total_modal=hpp_accounting, # Recording HPP as the modal in transactions table
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

        # 4. Settle Associated Financial Obligations (Workshop Piutangs & Unit Hutangs)
        self._settle_unit_financial_obligations(mobil, data.tanggal, nomor_transaksi, user_id)

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
                total_dibayar=data.dp,
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
            keterangan_prefix = "Penjualan" if status_bayar == PaymentStatus.LUNAS else "DP"
            if hasattr(data, 'payments') and data.payments:
                for p in data.payments:
                    if p.jumlah > 0:
                        create_kas_entry(
                            db=self.db,
                            tanggal=data.tanggal,
                            tipe=KasBankType.MASUK,
                            nominal=p.jumlah,
                            sumber=KasBankSource.JUAL_BELI_MOBIL,
                            metode_bayar=p.metode,
                            referensi_id=transaksi.id,
                            nomor_referensi=transaksi.nomor_transaksi,
                            keterangan=f"{keterangan_prefix} mobil {mobil.merek} {mobil.model} ({mobil.nomor_plat}) - {p.metode}",
                            user_id=user_id,
                        )
            else:
                create_kas_entry(
                    db=self.db,
                    tanggal=data.tanggal,
                    tipe=KasBankType.MASUK,
                    nominal=data.dp,
                    sumber=KasBankSource.JUAL_BELI_MOBIL,
                    metode_bayar=data.metode_bayar,
                    referensi_id=transaksi.id,
                    nomor_referensi=transaksi.nomor_transaksi,
                    keterangan=f"{keterangan_prefix} mobil {mobil.merek} {mobil.model} ({mobil.nomor_plat})",
                    user_id=user_id,
                )

        return transaksi

    def _settle_unit_financial_obligations(
        self, 
        mobil: Mobil, 
        tanggal: date, 
        ref_no: str, 
        user_id: Optional[int] = None
    ):
        """Robustly settle any outstanding workshop piutangs and unit payables (Hutangs) for this unit."""
        # --- A. PIUTANG (RECEIVABLES) SETTLEMENT ---
        # Workshop transactions for this car
        workshop_nos = [t.nomor_transaksi for t in mobil.bengkel_perbaikan if t.kategori == 'jual_beli_mobil']
        
        internal_piutangs = (
            self.db.query(PiutangUsaha)
            .filter(
                or_(
                    PiutangUsaha.nomor_referensi.in_(workshop_nos),
                    PiutangUsaha.nama_debitur.ilike(f"JB MOBIL - {mobil.nomor_plat}"),
                    PiutangUsaha.nama_debitur.ilike(f"JB MOBIL - {mobil.nomor_plat.replace(' ', '')}"),
                ),
                PiutangUsaha.sumber == PiutangSource.BENGKEL,
                PiutangUsaha.status != PiutangStatus.LUNAS
            )
            .all()
        )
        
        total_piutang_settled = Decimal("0")
        for p in internal_piutangs:
            amount = p.sisa_piutang
            if amount <= 0: continue
            total_piutang_settled += amount
            p.status = PiutangStatus.LUNAS
            p.total_dibayar = p.nominal_piutang
            p.sisa_piutang = Decimal("0")
            p.tanggal_lunas = tanggal
            p.catatan = (p.catatan or "") + f" | Terlunasi otomatis saat unit terjual (Ref: {ref_no})"
            
        if total_piutang_settled > 0:
            # 1. MASUK to Workshop (Paying their receivable)
            create_kas_entry(
                db=self.db, tanggal=tanggal, tipe=KasBankType.MASUK,
                nominal=total_piutang_settled, sumber=KasBankSource.BENGKEL, 
                metode_bayar=PaymentMethod.INTERNAL,
                referensi_id=None, nomor_referensi=ref_no,
                keterangan=f"Pelunasan Piutang Internal via Penjualan {mobil.nomor_plat}",
                user_id=user_id,
            )
            # 2. KELUAR from JB Mobil (Settling the repair cost)
            create_kas_entry(
                db=self.db, tanggal=tanggal, tipe=KasBankType.KELUAR,
                nominal=total_piutang_settled, sumber=KasBankSource.JUAL_BELI_MOBIL, 
                metode_bayar=PaymentMethod.INTERNAL,
                referensi_id=None, nomor_referensi=ref_no,
                keterangan=f"Pelunasan Biaya Repair Internal {mobil.nomor_plat}",
                user_id=user_id,
            )

        # --- B. HUTANG (PAYABLES) SETTLEMENT ---
        # Settle purchase debt or unit costs manually recorded as Hutang (BBN, Pajak via Biaya Unit)
        associated_hutangs = (
            self.db.query(HutangUsaha)
            .filter(
                or_(
                    HutangUsaha.nomor_referensi == mobil.kode,
                    HutangUsaha.referensi_id == mobil.id,
                    HutangUsaha.nama_kreditur.ilike(f"%{mobil.nomor_plat}%"),
                ),
                HutangUsaha.status != HutangStatus.LUNAS
            )
            .all()
        )

        for h in associated_hutangs:
            amount = h.sisa_hutang
            if amount <= 0: continue
            
            h.status = HutangStatus.LUNAS
            h.total_dibayar = h.nominal_hutang
            h.sisa_hutang = Decimal("0")
            h.tanggal_lunas = tanggal
            h.catatan = (h.catatan or "") + f" | Terlunasi otomatis saat unit terjual (Ref: {ref_no})"
            # NOTE: No KasBank entry here. The financial impact of the hutang was already
            # recorded when the cost was originally incurred (e.g. pembelian mobil, biaya BBN/pajak).
            # Creating a KELUAR entry here would double-count the expense in the capital report.

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
            piutang.total_dibayar += jumlah_bayar
            piutang.sisa_piutang = transaksi.sisa_bayar
            if transaksi.status_bayar == PaymentStatus.LUNAS:
                piutang.status = PiutangStatus.LUNAS
                piutang.sisa_piutang = Decimal("0")
                piutang.tanggal_lunas = date.today()
            else:
                piutang.status = PiutangStatus.SEBAGIAN

        # Update car status: BOOKING → TERJUAL when fully paid
        if transaksi.status_bayar == PaymentStatus.LUNAS:
            mobil = self.db.query(Mobil).filter(Mobil.id == transaksi.mobil_id).first()
            if mobil:
                # Ensure internal obligations are settled if they weren't already
                self._settle_unit_financial_obligations(mobil, date.today(), transaksi.nomor_transaksi, user_id)
                
                if mobil.status == CarStatus.BOOKING:
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
        aggregates = (
            query.join(Mobil, TransaksiPenjualanMobil.mobil_id == Mobil.id)
            .with_entities(
                func.sum(TransaksiPenjualanMobil.harga_jual).label("total_penjualan"),
                func.sum(TransaksiPenjualanMobil.total_modal).label("total_modal"),
                func.sum(TransaksiPenjualanMobil.laba_kotor).label("total_laba_kotor"),
                func.sum(TransaksiPenjualanMobil.laba_investor).label("total_laba_investor"),
                func.sum(TransaksiPenjualanMobil.laba_tpm).label("total_laba_tpm"),
                func.sum(TransaksiPenjualanMobil.dp).label("total_dp"),
                # Calculate realized parts (sum of the total_part_service of sold cars)
                # Note: Mobil.total_part_service is a hybrid property or similar, 
                # but we can sum the component values if needed. 
                # Let's use func.sum(Mobil.biaya_persiapan) or similar if available, 
                # but better to rely on what was recorded in total_modal.
            ).first()
        )
        
        # Recalculate component for parts realized by joining with Mobil and its additional costs
        realized_parts_q = (
            query.join(Mobil, TransaksiPenjualanMobil.mobil_id == Mobil.id)
            .join(MobilBiayaLainnya, Mobil.id == MobilBiayaLainnya.mobil_id)
            .filter(MobilBiayaLainnya.kategori == "Perawatan Bengkel")
        )
        total_parts_realized = float(realized_parts_q.with_entities(func.sum(MobilBiayaLainnya.jumlah)).scalar() or 0)

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
            "total_parts_realized": total_parts_realized,
            "total_modal_excluding_parts": float(aggregates.total_modal or 0) - total_parts_realized,
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
                "status_pencairan": t.status_pencairan.value if t.status_pencairan else "BELUM_DICAIRKAN",
                "tanggal_pencairan": t.tanggal_pencairan.isoformat() if t.tanggal_pencairan else None,
                "nominal_pencairan": float(t.nominal_pencairan or 0),
            }
            for t in transaksis
        ]

    def get_pending_disbursements(
        self,
        nama_investor: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Get list of investor car sales that haven't been disbursed yet."""
        query = (
            self.db.query(TransaksiPenjualanMobil)
            .join(Mobil)
            .filter(
                TransaksiPenjualanMobil.tipe_kepemilikan == OwnershipType.INVESTOR,
                TransaksiPenjualanMobil.status_bayar == PaymentStatus.LUNAS,
                or_(
                    TransaksiPenjualanMobil.status_pencairan == InvestorDisbursementStatus.BELUM_DICAIRKAN,
                    TransaksiPenjualanMobil.status_pencairan.is_(None),
                ),
            )
            .options(joinedload(TransaksiPenjualanMobil.mobil))
        )

        if nama_investor:
            query = query.filter(Mobil.nama_investor.ilike(f"%{nama_investor}%"))

        transaksis = query.order_by(TransaksiPenjualanMobil.tanggal.desc()).all()

        result = []
        for t in transaksis:
            # Nominal pencairan = modal investor + laba investor
            nominal_investor = float(t.mobil.nominal_investor or 0)
            laba_inv = float(t.laba_investor or 0)
            total_pencairan = nominal_investor + laba_inv

            result.append({
                "id": t.id,
                "tanggal_jual": t.tanggal.isoformat(),
                "nomor_transaksi": t.nomor_transaksi,
                "mobil": f"{t.mobil.merek} {t.mobil.model} ({t.mobil.nomor_plat})",
                "mobil_id": t.mobil_id,
                "nama_investor": t.mobil.nama_investor,
                "harga_beli": float(t.mobil.harga_beli),
                "nominal_investor": nominal_investor,
                "harga_jual": float(t.harga_jual),
                "total_modal": float(t.total_modal),
                "laba_kotor": float(t.laba_kotor),
                "persentase_investor": float(t.persentase_investor),
                "laba_investor": laba_inv,
                "laba_tpm": float(t.laba_tpm),
                "total_pencairan": total_pencairan,
                "status_pencairan": "BELUM_DICAIRKAN",
            })

        return result

    def process_disbursement(
        self,
        transaksi_id: int,
        payment_entries: List[tuple[PaymentMethod, Decimal]],
        total_nominal: Optional[Decimal] = None,
        tanggal: Optional[date] = None,
        catatan: str = "",
        user_id: Optional[int] = None,
    ) -> TransaksiPenjualanMobil:
        """Process investor fund disbursement for a sold car (supports partial & split payments)."""
        transaksi = (
            self.db.query(TransaksiPenjualanMobil)
            .options(
                joinedload(TransaksiPenjualanMobil.mobil),
                joinedload(TransaksiPenjualanMobil.rincian_pencairan)
            )
            .filter(TransaksiPenjualanMobil.id == transaksi_id)
            .first()
        )

        if not transaksi:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaksi penjualan tidak ditemukan",
            )

        if transaksi.tipe_kepemilikan != OwnershipType.INVESTOR:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transaksi ini bukan mobil investor",
            )

        if transaksi.status_bayar != PaymentStatus.LUNAS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Pembayaran mobil belum lunas, tidak bisa dicairkan",
            )

        if transaksi.status_pencairan == InvestorDisbursementStatus.DICAIRKAN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dana investor sudah dicairkan sepenuhnya sebelumnya",
            )

        # Calculate what should be disbursed
        nominal_investor = Decimal(str(transaksi.mobil.nominal_investor or 0))
        laba_inv = Decimal(str(transaksi.laba_investor or 0))
        target_pencairan = nominal_investor + laba_inv
        
        # Calculate what has been disbursed
        current_disbursed = sum(d.nominal for d in transaksi.rincian_pencairan) if transaksi.rincian_pencairan else Decimal("0")
        remaining_to_disburse = target_pencairan - current_disbursed

        # Validate payout amount
        if total_nominal is None:
            # If not specified, default to remaining amount
            total_nominal = remaining_to_disburse
            # If we're defaulting the total, and have one entry with no nominal, update it
            if len(payment_entries) == 1 and payment_entries[0][1] is None:
                payment_entries = [(payment_entries[0][0], total_nominal)]
        
        if total_nominal <= 0:
             raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nominal pencairan harus lebih dari 0",
            )

        if total_nominal > remaining_to_disburse:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Nominal pencairan ({total_nominal}) melebihi sisa dana ({remaining_to_disburse})",
            )

        # Validate split payments total
        total_payout_input = sum(n for m, n in payment_entries)
        if total_payout_input != total_nominal:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Total rincian pembayaran ({total_payout_input}) tidak sesuai dengan total pencairan ({total_nominal})",
            )

        tanggal_pencairan = tanggal or date.today()

        # Update transaction status
        new_total_disbursed = current_disbursed + total_nominal
        transaksi.nominal_pencairan = new_total_disbursed
        transaksi.tanggal_pencairan = tanggal_pencairan
        
        if new_total_disbursed >= target_pencairan:
            transaksi.status_pencairan = InvestorDisbursementStatus.DICAIRKAN
        else:
            transaksi.status_pencairan = InvestorDisbursementStatus.SEBAGIAN

        # Add records to history and cash book
        for metode, nominal in payment_entries:
            if nominal <= 0: continue
            
            # 1. Record detail
            detail = InvestorDisbursementDetail(
                transaksi_id=transaksi.id,
                tanggal=tanggal_pencairan,
                nominal=nominal,
                metode_bayar=metode,
                catatan=catatan or f"Pencairan dana investor {transaksi.mobil.nama_investor}",
                created_by=user_id
            )
            self.db.add(detail)

            # 2. Record cash outflow
            create_kas_entry(
                db=self.db,
                tanggal=tanggal_pencairan,
                tipe=KasBankType.KELUAR,
                nominal=nominal,
                sumber=KasBankSource.JUAL_BELI_MOBIL,
                metode_bayar=metode,
                referensi_id=transaksi.id,
                nomor_referensi=transaksi.nomor_transaksi,
                keterangan=f"Pencairan Investor {transaksi.mobil.nama_investor} ({metode}) - {transaksi.mobil.merek} ({transaksi.mobil.nomor_plat})",
                user_id=user_id,
            )

        self.db.commit()
        self.db.refresh(transaksi)
        return transaksi

    def get_disbursement_summary(
        self,
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
    ) -> Dict[str, Any]:
        """Get summary of investor disbursements."""
        # Pending
        q_pending = (
            self.db.query(TransaksiPenjualanMobil)
            .filter(
                TransaksiPenjualanMobil.tipe_kepemilikan == OwnershipType.INVESTOR,
                TransaksiPenjualanMobil.status_bayar == PaymentStatus.LUNAS,
                or_(
                    TransaksiPenjualanMobil.status_pencairan == InvestorDisbursementStatus.BELUM_DICAIRKAN,
                    TransaksiPenjualanMobil.status_pencairan.is_(None),
                ),
            )
        )
        pending_count = q_pending.count()
        pending_agg = q_pending.join(Mobil).with_entities(
            func.sum(Mobil.nominal_investor + TransaksiPenjualanMobil.laba_investor).label("total")
        ).scalar() or 0

        # Disbursed (in period)
        q_disbursed = (
            self.db.query(TransaksiPenjualanMobil)
            .filter(
                TransaksiPenjualanMobil.tipe_kepemilikan == OwnershipType.INVESTOR,
                TransaksiPenjualanMobil.status_pencairan == InvestorDisbursementStatus.DICAIRKAN,
            )
        )
        if tanggal_dari:
            q_disbursed = q_disbursed.filter(TransaksiPenjualanMobil.tanggal_pencairan >= tanggal_dari)
        if tanggal_sampai:
            q_disbursed = q_disbursed.filter(TransaksiPenjualanMobil.tanggal_pencairan <= tanggal_sampai)

        disbursed_count = q_disbursed.count()
        disbursed_total = float(
            q_disbursed.with_entities(
                func.sum(TransaksiPenjualanMobil.nominal_pencairan)
            ).scalar() or 0
        )

        return {
            "pending_count": pending_count,
            "pending_total": float(pending_agg),
            "disbursed_count": disbursed_count,
            "disbursed_total": disbursed_total,
        }

    def get_disbursement_history(
        self,
        nama_investor: Optional[str] = None,
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
    ) -> List[InvestorDisbursementDetail]:
        """Get history of all investor disbursements."""
        query = (
            self.db.query(InvestorDisbursementDetail)
            .join(InvestorDisbursementDetail.transaksi)
            .join(TransaksiPenjualanMobil.mobil)
        )
        
        if nama_investor:
            query = query.filter(Mobil.nama_investor.ilike(f"%{nama_investor}%"))
        if tanggal_dari:
            query = query.filter(InvestorDisbursementDetail.tanggal >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(InvestorDisbursementDetail.tanggal <= tanggal_sampai)
            
        return query.order_by(InvestorDisbursementDetail.tanggal.desc(), InvestorDisbursementDetail.id.desc()).all()
