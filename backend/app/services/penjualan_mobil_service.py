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
from app.utils.constants import KasBankJenis
from app.models.keuangan import PiutangUsaha, HutangUsaha, HutangStatus, HutangSource, KasBank


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

        # Use the manually provided percentage directly
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
        # 0. Pre-check: Prevent double sale (Database unique constraint fallback)
        existing = self.db.query(TransaksiPenjualanMobil).filter(
            TransaksiPenjualanMobil.mobil_id == data.mobil_id,
            TransaksiPenjualanMobil.status_bayar != PaymentStatus.BATAL
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Mobil ini sudah memiliki data penjualan ({existing.nomor_transaksi})",
            )

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
        # As per user request: HPP = Beli + Persiapan (excludes internal repair)
        hpp_accounting = mobil.hpp
        
        # total_part_service = cumulative Part & Service costs (Internal Workshop)
        total_part_service = mobil.total_part_service
        
        # Real Modal (Investment) for profit split calculations
        # Investors split after ALL costs are covered (including internal repairs)
        real_total_modal = hpp_accounting + total_part_service
        
        # Laba Kotor for Transaction Record = Harga Jual - HPP_Accounting
        # Note: Internal repair is handled via separate settlement and recognized as Workshop Profit
        laba_kotor = data.harga_jual - hpp_accounting

        # Laba for Investor Split (Real Profit) = Harga Jual - Real Total Modal
        laba_split_investor = data.harga_jual - real_total_modal

        # Calculate profit split using laba_split_investor
        laba_investor, _ = self._calculate_profit_split(
            laba_split_investor,
            mobil.tipe_kepemilikan,
            mobil.persentase_investor,
            mobil.nominal_investor,
            real_total_modal,
        )
        
        # TPM's share of this specific transaction is the remaining Accounting Laba
        laba_tpm = laba_kotor - laba_investor

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
                unit=KasBankSource.JUAL_BELI_MOBIL,
                referensi_id=None,  # Will update after flushing transaksi
                nomor_referensi=nomor_transaksi,
                nominal_piutang=sisa_bayar,
                total_dibayar=Decimal("0"),
                sisa_piutang=sisa_bayar,
                status=PiutangStatus.BELUM_LUNAS if data.dp == 0 else PiutangStatus.SEBAGIAN,
                catatan=f"Piutang penjualan mobil {mobil.merek} {mobil.model} ({mobil.nomor_plat})",
                created_by=user_id,
            )
            self.db.add(piutang)
            
        # Flush everything before creating KasBank entries so IDs are available
        self.db.flush()
        
        # Update piutang referensi_id if created
        if status_bayar != PaymentStatus.LUNAS:
            piutang.referensi_id = transaksi.id

        # 4. Record DP payment to kas/bank if any
        if data.dp > 0:
            keterangan_prefix = "Lunas" if status_bayar == PaymentStatus.LUNAS else "DP"
            if hasattr(data, 'payments') and data.payments:
                for p in data.payments:
                    if p.nominal > 0:
                        create_kas_entry(
                            db=self.db,
                            tanggal=data.tanggal,
                            tipe=KasBankType.MASUK,
                            nominal=p.nominal,
                            sumber=KasBankSource.JUAL_BELI_MOBIL,
                            metode_bayar=p.metode,
                            referensi_id=transaksi.id,
                            nomor_referensi=transaksi.nomor_transaksi,
                            keterangan=f"{keterangan_prefix} mobil {mobil.merek} {mobil.model} ({mobil.nomor_plat}) - {p.metode}",
                            user_id=user_id,
                            kas_jenis=p.kas_jenis,
                            commit=False # ATOMIC
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
                    commit=False # ATOMIC
                )
        
        # 5. Settle Associated Financial Obligations (Workshop Piutangs & Unit Hutangs)
        # Process this AFTER adding funds to JUAL_BELI_MOBIL to avoid insufficient funds error for Internal transfers.
        self._settle_unit_financial_obligations(mobil, data.tanggal, nomor_transaksi, user_id)

        # FINAL SINGLE COMMIT
        self.db.commit()
        self.db.refresh(transaksi)

        return transaksi



    def _settle_unit_financial_obligations(
        self, 
        mobil: Mobil, 
        tanggal: date, 
        ref_no: str, 
        user_id: Optional[int] = None
    ):
        """Robustly settle any outstanding workshop piutangs and unit payables (Hutangs) for this unit."""
        # --- A. PIUTANG (RECEIVABLES) & WORKSHOP SETTLEMENT ---
        # 1. Update all unpaid workshop transactions for this car to LUNAS directly
        # This fixes the "Belum Bayar" status in the Workshop Index regardless of category
        self.db.query(TransaksiPenjualanBengkel).filter(
            TransaksiPenjualanBengkel.mobil_id == mobil.id,
            TransaksiPenjualanBengkel.status_bayar != PaymentStatus.LUNAS
        ).update({
            "status_bayar": PaymentStatus.LUNAS,
            "jumlah_bayar": TransaksiPenjualanBengkel.grand_total,
            "status_pengerjaan": WorkshopStatus.SELESAI
        }, synchronize_session='fetch')

        # 2. Update linked Piutang records
        workshop_nos = [t.nomor_transaksi for t in mobil.bengkel_perbaikan]
        
        internal_pi_q = self.db.query(PiutangUsaha).filter(
            or_(
                PiutangUsaha.nomor_referensi.in_(workshop_nos),
                PiutangUsaha.nama_debitur.ilike(f"JB MOBIL - {mobil.nomor_plat}"),
                PiutangUsaha.nama_debitur.ilike(f"JB MOBIL - {mobil.nomor_plat.replace(' ', '')}"),
            ),
            PiutangUsaha.status != PiutangStatus.LUNAS
        )
        
        # Calculate amount settled for any logging/adjustments if needed
        total_piutang_settled = Decimal("0")
        for p in internal_pi_q.all():
            total_piutang_settled += p.sisa_piutang
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
                commit=False # ATOMIC
            )
            # 2. KELUAR from JB Mobil (Settling the repair cost)
            create_kas_entry(
                db=self.db, tanggal=tanggal, tipe=KasBankType.KELUAR,
                nominal=total_piutang_settled, sumber=KasBankSource.JUAL_BELI_MOBIL, 
                metode_bayar=PaymentMethod.INTERNAL,
                referensi_id=None, nomor_referensi=ref_no,
                keterangan=f"Pelunasan Biaya Repair Internal {mobil.nomor_plat}",
                user_id=user_id,
                allow_negative=True, # Safety for internal reclassifications
                commit=False # ATOMIC
            )

        # --- B. HUTANG (PAYABLES) SETTLEMENT ---
        # REMOVED: Automatic settlement disabled per user request.
        # External debts must be settled manually to ensure accurate cash tracking.
        pass

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
        mobil_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Get list of transactions with pagination and filters."""
        # Base query (use outerjoin for mobil because BATAL transactions are detached)
        query = self.db.query(TransaksiPenjualanMobil).options(
            joinedload(TransaksiPenjualanMobil.mobil),
            joinedload(TransaksiPenjualanMobil.customer),
        )

        # Apply default status filter if not explicitly provided
        if not status_bayar:
            # Exclude BATAL from general list unless specifically requested
            query = query.filter(TransaksiPenjualanMobil.status_bayar != PaymentStatus.BATAL)
        else:
            query = query.filter(TransaksiPenjualanMobil.status_bayar == status_bayar)

        # Search filter
        if search:
            search_filter = f"%{search}%"
            # Use outerjoin to allow searching for cancelled transactions too
            query = query.outerjoin(TransaksiPenjualanMobil.mobil).filter(
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

        # Mobil filter
        if mobil_id:
            query = query.filter(TransaksiPenjualanMobil.mobil_id == mobil_id)

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
        payments: List[tuple[PaymentMethod, Decimal, Optional[KasBankJenis]]],
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

        self.db.flush()

        # Record payment to kas/bank
        for metode, nominal, kas_jenis in payments:
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
                    kas_jenis=kas_jenis,
                    commit=False
                )

        self.db.commit()
        self.db.refresh(transaksi)

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

        # 1. Revert car status to TERSEDIA and DETACH transaction
        mobil.status = CarStatus.TERSEDIA
        mobil.tanggal_terjual = None
        
        # 2. Update transaction status and detach from mobil
        transaksi.status_bayar = PaymentStatus.BATAL
        transaksi.mobil_id = None  # Crucial: Allow car to be sold again
        
        # Adjust financial values to reflect only the penalty
        transaksi.harga_jual = penalti
        transaksi.total_modal = Decimal("0")
        transaksi.laba_kotor = penalti
        transaksi.laba_investor = Decimal("0") # Penalty usually stays with TPM unless split
        transaksi.laba_tpm = penalti
        transaksi.dp = penalti
        transaksi.sisa_bayar = Decimal("0")
        
        catatan_batal = f"DIBATALKAN - Penalti: {penalti}, Refund: {refund}"
        if alasan:
            catatan_batal += f" | Alasan: {alasan}"
        transaksi.catatan = catatan_batal

        # 3. Mark piutang as BATAL (if any)
        piutang = (
            self.db.query(PiutangUsaha)
            .filter(
                PiutangUsaha.nomor_referensi == transaksi.nomor_transaksi,
                PiutangUsaha.sumber == PiutangSource.JUAL_BELI_MOBIL,
            )
            .first()
        )
        if piutang:
            piutang.status = PiutangStatus.BATAL
            piutang.sisa_piutang = Decimal("0")
            piutang.catatan = f"Booking dibatalkan. {catatan_batal}"

        self.db.flush()

        # 4. Note: We DO NOT record a new MASUK for the penalty because it is
        # already in the bank from the original DP. We only record the REFUND (KELUAR).
        # This prevents double-counting the penalty money in KasBank.

        # 5. Record refund as expense (if > 0)
        if refund > 0:
            if not refund_entries:
                # Fallback to cash if no entries provided
                refund_entries = [(PaymentMethod.TUNAI, refund)]
            
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
                        keterangan=f"Refund pembatalan booking {transaksi.nomor_transaksi} ({metode})",
                        user_id=user_id,
                        commit=False
                    )

        self.db.commit()
        self.db.refresh(transaksi)

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


    def get_summary(
        self,
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
        search: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get sales summary statistics."""
        # Base query
        query = self.db.query(TransaksiPenjualanMobil)

        if tanggal_dari:
            query = query.filter(TransaksiPenjualanMobil.tanggal >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(TransaksiPenjualanMobil.tanggal <= tanggal_sampai)

        if search:
            q = f"%{search}%"
            query = query.outerjoin(Mobil, TransaksiPenjualanMobil.mobil_id == Mobil.id).filter(
                or_(
                    TransaksiPenjualanMobil.nomor_transaksi.ilike(q),
                    Mobil.nama_pembeli.ilike(q),
                    Mobil.nomor_plat.ilike(q),
                    Mobil.merek.ilike(q),
                    Mobil.model.ilike(q),
                )
            )

        # Total transactions
        total_count = query.count()

        # Payment Status Counts
        lunas_count = query.filter(TransaksiPenjualanMobil.status_bayar == PaymentStatus.LUNAS).count()
        partial_count = query.filter(TransaksiPenjualanMobil.status_bayar == PaymentStatus.CICILAN).count()
        unpaid_count = query.filter(TransaksiPenjualanMobil.status_bayar == PaymentStatus.BELUM_LUNAS).count()
        batal_count = query.filter(TransaksiPenjualanMobil.status_bayar == PaymentStatus.BATAL).count()

        # Aggregate values (Excluding BATAL for financial totals)
        aggregates = (
            query.filter(TransaksiPenjualanMobil.status_bayar != PaymentStatus.BATAL)
            .outerjoin(Mobil, TransaksiPenjualanMobil.mobil_id == Mobil.id)
            .with_entities(
                func.sum(TransaksiPenjualanMobil.harga_jual).label("total_penjualan"),
                func.sum(TransaksiPenjualanMobil.total_modal).label("total_modal"),
                func.sum(Mobil.harga_beli).label("total_harga_beli"),
                func.sum(TransaksiPenjualanMobil.laba_kotor).label("total_laba_kotor"),
                func.sum(TransaksiPenjualanMobil.laba_investor).label("total_laba_investor"),
                func.sum(TransaksiPenjualanMobil.laba_tpm).label("total_laba_tpm"),
                func.sum(TransaksiPenjualanMobil.dp).label("total_dp"),
            ).first()
        )
        
        # Total Bengkel (All workshop transactions tied to jual_beli_mobil, plus Perawatan Bengkel)
        bengkel_parts_q = self.db.query(func.sum(TransaksiPenjualanBengkel.grand_total)).filter(
            TransaksiPenjualanBengkel.kategori.in_(['jual_beli_mobil', 'mobil', 'penjualan_mobil']),
            TransaksiPenjualanBengkel.status_bayar != PaymentStatus.BATAL
        )
        if tanggal_dari: bengkel_parts_q = bengkel_parts_q.filter(TransaksiPenjualanBengkel.tanggal >= tanggal_dari)
        if tanggal_sampai: bengkel_parts_q = bengkel_parts_q.filter(TransaksiPenjualanBengkel.tanggal <= tanggal_sampai)
        
        # Any manual operational costs keyed as Perawatan Bengkel
        bengkel_tambahan_q = self.db.query(func.sum(MobilBiayaLainnya.jumlah)).filter(
            MobilBiayaLainnya.kategori == "Perawatan Bengkel"
        )
        if tanggal_dari: bengkel_tambahan_q = bengkel_tambahan_q.filter(MobilBiayaLainnya.tanggal >= tanggal_dari)
        if tanggal_sampai: bengkel_tambahan_q = bengkel_tambahan_q.filter(MobilBiayaLainnya.tanggal <= tanggal_sampai)
        
        total_biaya_bengkel = float((bengkel_parts_q.scalar() or 0) + (bengkel_tambahan_q.scalar() or 0))

        # Unpaid values (Sisa Bayar)
        unpaid_value = (
            query.filter(TransaksiPenjualanMobil.status_bayar.in_([PaymentStatus.BELUM_LUNAS, PaymentStatus.CICILAN]))
            .with_entities(func.sum(TransaksiPenjualanMobil.sisa_bayar))
            .scalar()
            or Decimal("0")
        )

        # --- NEW CASH BREAKDOWN FOR WALLET ---
        # 1. Total Tunai (Payments entering KAS_UNIT_MOBIL)
        total_tunai_q = self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.jenis == KasBankJenis.KAS_UNIT_MOBIL,
            KasBank.tipe == KasBankType.MASUK,
            or_(
                KasBank.sumber == KasBankSource.JUAL_BELI_MOBIL,
                KasBank.sumber == KasBankSource.PIUTANG
            )
        ).filter(~KasBank.keterangan.ilike("%Akun Utama%"))
        
        # 2. Total Transfer (Payments directly to Main Bank)
        total_transfer_q = self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.jenis == KasBankJenis.BANK_UTAMA,
            KasBank.tipe == KasBankType.MASUK,
            or_(
                KasBank.sumber == KasBankSource.JUAL_BELI_MOBIL,
                KasBank.sumber == KasBankSource.PIUTANG
            )
        )

        # 3. Total Dana Dari Utama (Replenishment)
        total_dana_dari_utama_q = self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.jenis == KasBankJenis.KAS_UNIT_MOBIL,
            KasBank.tipe == KasBankType.MASUK,
            KasBank.keterangan.ilike("%Akun Utama%")
        )

        if tanggal_dari:
            total_tunai_q = total_tunai_q.filter(KasBank.tanggal >= tanggal_dari)
            total_transfer_q = total_transfer_q.filter(KasBank.tanggal >= tanggal_dari)
            total_dana_dari_utama_q = total_dana_dari_utama_q.filter(KasBank.tanggal >= tanggal_dari)
        if tanggal_sampai:
            total_tunai_q = total_tunai_q.filter(KasBank.tanggal <= tanggal_sampai)
            total_transfer_q = total_transfer_q.filter(KasBank.tanggal <= tanggal_sampai)
            total_dana_dari_utama_q = total_dana_dari_utama_q.filter(KasBank.tanggal <= tanggal_sampai)
        
        # 4. Total car purchases in period (Realization)
        total_pembelian_period_q = self.db.query(func.sum(Mobil.harga_beli)).filter(Mobil.deleted_at.is_(None))
        if tanggal_dari: total_pembelian_period_q = total_pembelian_period_q.filter(Mobil.tanggal_masuk >= tanggal_dari)
        if tanggal_sampai: total_pembelian_period_q = total_pembelian_period_q.filter(Mobil.tanggal_masuk <= tanggal_sampai)
        total_pembelian_period = float(total_pembelian_period_q.scalar() or 0)
        # Breakdown of bengkel per mobil
        
        bengkel_mobil_query = self.db.query(
            Mobil.model,
            Mobil.nomor_plat,
            func.sum(TransaksiPenjualanBengkel.grand_total)
        ).join(
            Mobil, TransaksiPenjualanBengkel.mobil_id == Mobil.id
        ).filter(
            TransaksiPenjualanBengkel.kategori.in_(['jual_beli_mobil', 'mobil', 'penjualan_mobil']),
            TransaksiPenjualanBengkel.status_bayar != PaymentStatus.BATAL
        )
        if tanggal_dari: bengkel_mobil_query = bengkel_mobil_query.filter(TransaksiPenjualanBengkel.tanggal >= tanggal_dari)
        if tanggal_sampai: bengkel_mobil_query = bengkel_mobil_query.filter(TransaksiPenjualanBengkel.tanggal <= tanggal_sampai)
        
        bengkel_mobil_parts = bengkel_mobil_query.group_by(Mobil.model, Mobil.nomor_plat).all()
        
        bengkel_tambahan_mobil_query = self.db.query(
            Mobil.model,
            Mobil.nomor_plat,
            func.sum(MobilBiayaLainnya.jumlah)
        ).join(
            Mobil, MobilBiayaLainnya.mobil_id == Mobil.id
        ).filter(
            MobilBiayaLainnya.kategori == "Perawatan Bengkel"
        )
        if tanggal_dari: bengkel_tambahan_mobil_query = bengkel_tambahan_mobil_query.filter(MobilBiayaLainnya.tanggal >= tanggal_dari)
        if tanggal_sampai: bengkel_tambahan_mobil_query = bengkel_tambahan_mobil_query.filter(MobilBiayaLainnya.tanggal <= tanggal_sampai)
        
        bengkel_tambahan_mobil = bengkel_tambahan_mobil_query.group_by(Mobil.model, Mobil.nomor_plat).all()
        
        # Combine
        bengkel_per_mobil = {}
        for row in bengkel_mobil_parts:
            key = f"{row[0]} ({row[1]})" if row[0] and row[1] else (row[0] or row[1] or "Unknown")
            bengkel_per_mobil[key] = bengkel_per_mobil.get(key, 0) + float(row[2] or 0)
            
        for row in bengkel_tambahan_mobil:
            key = f"{row[0]} ({row[1]})" if row[0] and row[1] else (row[0] or row[1] or "Unknown")
            bengkel_per_mobil[key] = bengkel_per_mobil.get(key, 0) + float(row[2] or 0)

        # Get list of sold car IDs and their model/plat strings for matching
        sold_q = self.db.query(TransaksiPenjualanMobil.mobil_id, Mobil.model, Mobil.nomor_plat).join(
            Mobil, TransaksiPenjualanMobil.mobil_id == Mobil.id
        ).filter(
            TransaksiPenjualanMobil.status_bayar != PaymentStatus.BATAL
        )
        if tanggal_dari: sold_q = sold_q.filter(TransaksiPenjualanMobil.tanggal >= tanggal_dari)
        if tanggal_sampai: sold_q = sold_q.filter(TransaksiPenjualanMobil.tanggal <= tanggal_sampai)
        
        sold_results = sold_q.all()
        sold_ids = [{"mobil_id": r[0]} for r in sold_results]
        sold_keys = {f"{r[1]} ({r[2]})" if r[1] and r[2] else (r[1] or r[2] or "Unknown") for r in sold_results}

        # Calculate bengkel costs for unsold cars only
        total_biaya_bengkel_unsold = 0
        for key, val in bengkel_per_mobil.items():
            if key not in sold_keys:
                total_biaya_bengkel_unsold += val

        # Calculate total dynamic modal (Full cost: Price + Prep + Dandan)
        total_full_modal = Decimal("0")
        total_external_modal = Decimal("0") # Just price + prep
        for m_id in [r[0] for r in sold_results]:
            m_obj = self.db.query(Mobil).get(m_id)
            if m_obj:
                total_full_modal += m_obj.total_modal
                total_external_modal += m_obj.hpp
        
        # This is the TRUE external gross profit (Sales - (Buy + Prep + PartsCost))
        # But for unit net, we use full modal (including internal profit transfer)
        dynamic_laba_unit = Decimal(aggregates.total_penjualan or 0) - total_full_modal
        
        # Calculate preparation costs (HPP - Price)
        total_prep = float(total_external_modal - (aggregates.total_harga_beli or 0))
        
        total_laba_kotor_val = float(dynamic_laba_unit)
        total_laba_tpm_val = float(dynamic_laba_unit - (aggregates.total_laba_investor or 0))

        return {
            "total_transaksi": total_count,
            "lunas_count": lunas_count,
            "partial_count": partial_count,
            "unpaid_count": unpaid_count,
            "batal_count": batal_count,
            "total_penjualan": float(aggregates.total_penjualan or 0),
            "total_modal": float(total_external_modal), # What user calls HPP
            "total_harga_beli": float(aggregates.total_harga_beli or 0),
            "total_biaya_persiapan": total_prep,
            "total_pembelian_period": total_pembelian_period,
            "total_laba_kotor": total_laba_kotor_val,
            "laba_investor": float(aggregates.total_laba_investor or 0),
            "laba_tpm": total_laba_tpm_val,
            "total_dp": float(aggregates.total_dp or 0),
            "total_biaya_bengkel": total_biaya_bengkel,
            "total_biaya_bengkel_unsold": total_biaya_bengkel_unsold,
            "biaya_bengkel": total_biaya_bengkel, # keep fallback
            "bengkel_per_mobil": bengkel_per_mobil,
            "piutang_nilai": float(unpaid_value),
            "saldo_bop": float(KasBank.get_current_balance(self.db, KasBankJenis.KAS_UNIT_MOBIL)),
            "total_tunai": float(total_tunai_q.scalar() or 0),
            "total_transfer": float(total_transfer_q.scalar() or 0),
            "total_dana_dari_utama": float(total_dana_dari_utama_q.scalar() or 0),
            "sold_list": sold_ids
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
