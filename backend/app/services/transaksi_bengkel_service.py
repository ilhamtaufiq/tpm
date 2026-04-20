from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any, List

from sqlalchemy import func, or_, case
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from app.models.bengkel import (
    TransaksiPenjualanBengkel,
    DetailTransaksiSpareParts,
    DetailTransaksiServices,
    SparePart,
)
from app.models.customer import Customer
from app.models.keuangan import PiutangUsaha, KasBank, PembayaranPiutang
from app.models.mobil import MobilPartService
from app.models.jasa_angkut import JasaAngkutPartService
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
    KasBankJenis,
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
        
        # For jasa_angkut / jual_beli_mobil: payment method is INTERNAL
        # Cost is deducted from Laba TPM (jasa_angkut) or added to HPP (mobil)
        is_internal_jasa_angkut = (getattr(data, "kategori", "umum") == "jasa_angkut")
        is_internal_mobil = (getattr(data, "kategori", "umum") == "jual_beli_mobil" and getattr(data, "mobil_id", None))
        
        if is_internal_jasa_angkut or is_internal_mobil:
            # Internal transactions for JA and JB Mobil are considered paid internally
            # This moves cash between unit wallets immediately
            total_pembayaran = grand_total
            metode_utama = PaymentMethod.INTERNAL
        elif data.payments:
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
            armada_id=getattr(data, 'armada_id', None),
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
            if sp.stok != 999:
                sp.stok -= item.qty

        # Create piutang if not fully paid
        if status_bayar != PaymentStatus.LUNAS:
            # Special debtor name for JB Mobil internal transfers
            debtor_name = nama_customer or (customer.nama if customer else "Guest")
            if is_internal_mobil:
                debtor_name = f"JB MOBIL - {data.nomor_plat}"

            out_amount = grand_total
            piutang = PiutangUsaha(
                nomor_piutang=self._generate_nomor_piutang(),
                tanggal=data.tanggal,
                customer_id=customer.id if customer else None,
                nama_debitur=debtor_name,
                telepon_debitur=customer.telepon if customer else None,
                alamat_debitur=customer.alamat if customer else None,
                sumber=PiutangSource.JUAL_BELI_MOBIL if is_internal_mobil else PiutangSource.BENGKEL,
                referensi_id=None,  # Will update after commit
                nomor_referensi=nomor_transaksi,
                nominal_piutang=out_amount,
                total_dibayar=Decimal("0"),
                sisa_piutang=out_amount,
                status=PiutangStatus.BELUM_LUNAS,
                catatan=f"Piutang Internal JB Mobil dari transaksi bengkel {nomor_transaksi}" if is_internal_mobil else f"Piutang dari transaksi bengkel {nomor_transaksi}",
                created_by=user_id,
            )
            self.db.add(piutang)


        self.db.commit()
        self.db.refresh(transaksi)

        # Update Piutang's referensi_id and process DP if any
        if not is_internal_jasa_angkut:
            # Determine correct sumber based on category
            piutang_sumber = PiutangSource.JUAL_BELI_MOBIL if is_internal_mobil else PiutangSource.BENGKEL
            piutang_record = self.db.query(PiutangUsaha).filter(
                PiutangUsaha.nomor_referensi == nomor_transaksi,
                PiutangUsaha.sumber == piutang_sumber
            ).first()
            if piutang_record:
                piutang_record.referensi_id = transaksi.id

                if is_internal_mobil:
                    # Internal JB Mobil: bilateral cash has already moved via KasBank.
                    # Mark piutang as LUNAS immediately so it doesn't inflate Section B.
                    piutang_record.status = PiutangStatus.LUNAS
                    piutang_record.total_dibayar = piutang_record.nominal_piutang
                    piutang_record.sisa_piutang = Decimal("0")
                elif total_pembayaran > 0:
                    # External customer: process DP payment against piutang
                    from app.services.piutang_service import PiutangService
                    from app.schemas.keuangan import PembayaranPiutangSplit
                    
                    p_service = PiutangService(self.db)
                    payment_items = []
                    if data.payments:
                        for p in data.payments:
                            if p.jumlah > 0:
                                payment_items.append({
                                    "metode": p.metode,
                                    "nominal": p.jumlah,
                                    "catatan": "DP Pembelian Bengkel"
                                })
                    else:
                        payment_items.append({
                            "metode": data.metode_bayar,
                            "nominal": data.jumlah_bayar,
                            "catatan": "DP Pembelian Bengkel"
                        })
                        
                    if payment_items:
                        p_service.process_payment_split(
                            PembayaranPiutangSplit(
                                piutang_id=piutang_record.id,
                                tanggal=data.tanggal,
                                payments=payment_items,
                                catatan=f"DP Transaksi {nomor_transaksi}"
                            ),
                            user_id=user_id
                        )
                self.db.commit()


        # Link to Mobil if category is jual_beli_mobil (Add to HPP)
        if transaksi.kategori == 'jual_beli_mobil' and transaksi.mobil_id:
            # Add parts to car history
            for detail in transaksi.detail_parts:
                sp = spare_parts_map.get(detail.spare_part_id)
                self.db.add(MobilPartService(
                    mobil_id=transaksi.mobil_id,
                    tanggal=transaksi.tanggal,
                    tipe='part',
                    deskripsi=f"Sparepart: {sp.nama if sp else 'Part'}",
                    qty=detail.qty,
                    harga_satuan=detail.harga_jual,
                    total=detail.subtotal,
                    catatan=f"Trans Bengkel: {transaksi.nomor_transaksi}"
                ))
            
            # Add services to car history
            for detail in transaksi.detail_services:
                self.db.add(MobilPartService(
                    mobil_id=transaksi.mobil_id,
                    tanggal=transaksi.tanggal,
                    tipe='service',
                    deskripsi=f"Service: {detail.nama_jasa}",
                    qty=detail.qty,
                    harga_satuan=detail.harga,
                    total=detail.subtotal,
                    catatan=f"Trans Bengkel: {transaksi.nomor_transaksi}"
                ))

        # Link to Jasa Angkut if category is jasa_angkut
        if transaksi.kategori == 'jasa_angkut' and transaksi.muatan_id:
            from app.models.jasa_angkut import MuatanJasaAngkut
            muatan = self.db.query(MuatanJasaAngkut).filter(MuatanJasaAngkut.id == transaksi.muatan_id).first()
            
            # Add parts to trip costs
            for detail in transaksi.detail_parts:
                sp = spare_parts_map.get(detail.spare_part_id)
                self.db.add(JasaAngkutPartService(
                    muatan_id=transaksi.muatan_id,
                    tanggal=transaksi.tanggal,
                    tipe='part',
                    deskripsi=f"Sparepart: {sp.nama if sp else 'Part'}",
                    qty=detail.qty,
                    harga_satuan=detail.harga_jual,
                    total=detail.subtotal,
                    catatan=f"Trans Bengkel: {transaksi.nomor_transaksi}"
                ))
            
            # Add services to trip costs
            for detail in transaksi.detail_services:
                self.db.add(JasaAngkutPartService(
                    muatan_id=transaksi.muatan_id,
                    tanggal=transaksi.tanggal,
                    tipe='service',
                    deskripsi=f"Service: {detail.nama_jasa}",
                    qty=detail.qty,
                    harga_satuan=detail.harga,
                    total=detail.subtotal,
                    catatan=f"Trans Bengkel: {transaksi.nomor_transaksi}"
                ))
            
            if muatan and transaksi.muatan_id:
                self.db.flush() # Ensure PartService records are in session
                # Refresh to pick up newly added part_services
                self.db.refresh(muatan)
                muatan.calculate_profit()
                self.db.commit() # Persist recalculated profit

        # Record payment to kas/bank
        # 1. Handle Internal/Integrated Transactions
        source_pocket = KasBankSource.BENGKEL
        if getattr(data, 'kategori', 'umum') == 'jasa_angkut':
            source_pocket = KasBankSource.JASA_ANGKUT
        elif getattr(data, 'kategori', 'umum') == 'jual_beli_mobil':
            source_pocket = KasBankSource.JUAL_BELI_MOBIL

        # Helper to record MASUK and KELUAR for internal flows
        def record_bilateral_payment(amount, method, ref_id, ref_num):
            # MASUK to Workshop
            create_kas_entry(
                db=self.db, tanggal=data.tanggal, tipe=KasBankType.MASUK,
                nominal=amount, sumber=KasBankSource.BENGKEL, metode_bayar=method,
                referensi_id=ref_id, nomor_referensi=ref_num,
                keterangan=f"Pembayaran ({method.upper()}) bengkel {ref_num}",
                user_id=user_id,
            )
            # KELUAR from Unit (if internal/integrated)
            if source_pocket != KasBankSource.BENGKEL:
                create_kas_entry(
                    db=self.db, tanggal=data.tanggal, tipe=KasBankType.KELUAR,
                    nominal=amount, sumber=source_pocket, metode_bayar=method,
                    referensi_id=ref_id, nomor_referensi=ref_num,
                    keterangan=f"Biaya Repair Internal via Bengkel: {ref_num}",
                    user_id=user_id,
                    allow_negative=True,
                )

        # Record internal transfer for integrated units
        if is_internal_jasa_angkut or is_internal_mobil:
            record_bilateral_payment(grand_total, PaymentMethod.INTERNAL, transaksi.id, transaksi.nomor_transaksi)
        
        # 2. Handle Non-Internal (UMUM) LUNAS Transactions 
        # (Internal Mobil and non-internal partial payments are already handled via Piutang system)
        elif not is_internal_mobil and status_bayar == PaymentStatus.LUNAS:
            if total_pembayaran > 0:
                # If multiple payments exist, record each one
                if data.payments:
                    for p in data.payments:
                        if p.jumlah > 0:
                            create_kas_entry(
                                db=self.db, tanggal=data.tanggal, tipe=KasBankType.MASUK,
                                nominal=p.jumlah, sumber=KasBankSource.BENGKEL, 
                                metode_bayar=p.metode,
                                referensi_id=transaksi.id, nomor_referensi=nomor_transaksi,
                                keterangan=f"Pembayaran Bengkel: {nomor_transaksi} ({p.metode})",
                                user_id=user_id,
                            )
                else:
                    # Single payment
                    create_kas_entry(
                        db=self.db, tanggal=data.tanggal, tipe=KasBankType.MASUK,
                        nominal=total_pembayaran, sumber=KasBankSource.BENGKEL, 
                        metode_bayar=metode_utama,
                        referensi_id=transaksi.id, nomor_referensi=nomor_transaksi,
                        keterangan=f"Pembayaran Lunas Bengkel: {nomor_transaksi}",
                        user_id=user_id,
                    )

        self.db.commit()

        return transaksi

    def update(
        self,
        transaksi_id: int,
        data: Any, # Use any since we handle mixed schemas
        user_id: Optional[int] = None,
    ) -> TransaksiPenjualanBengkel:
        """Update an existing workshop transaction."""
        transaksi = self.get_by_id(transaksi_id)

        # 1. Restore stock
        for detail in transaksi.detail_parts:
            sp = self.db.query(SparePart).filter(SparePart.id == detail.spare_part_id).first()
            if sp and sp.stok != 999:
                sp.stok += detail.qty

        # 2. Delete old details
        self.db.query(DetailTransaksiSpareParts).filter(DetailTransaksiSpareParts.transaksi_id == transaksi_id).delete(synchronize_session=False)
        self.db.query(DetailTransaksiServices).filter(DetailTransaksiServices.transaksi_id == transaksi_id).delete(synchronize_session=False)

        # 3. Delete related KasBank, Piutang, and unit history
        # (similar to void but keeps the main transaction)
        piutang = self.db.query(PiutangUsaha).filter(
            PiutangUsaha.nomor_referensi == transaksi.nomor_transaksi,
            PiutangUsaha.sumber == PiutangSource.BENGKEL
        ).first()

        self.db.query(KasBank).filter(
            KasBank.referensi_id == transaksi.id,
            KasBank.sumber == KasBankSource.BENGKEL
        ).delete(synchronize_session=False)

        if piutang:
            pembayaran_ids = [p.id for p in piutang.pembayaran]
            if pembayaran_ids:
                self.db.query(KasBank).filter(
                    KasBank.referensi_id.in_(pembayaran_ids),
                    or_(KasBank.sumber == KasBankSource.PIUTANG, KasBank.sumber == KasBankSource.BENGKEL),
                    KasBank.nomor_referensi == piutang.nomor_piutang
                ).delete(synchronize_session=False)

            self.db.delete(piutang)

        self.db.query(MobilPartService).filter(
            MobilPartService.catatan.like(f"%{transaksi.nomor_transaksi}%")
        ).delete(synchronize_session=False)

        self.db.query(JasaAngkutPartService).filter(
            JasaAngkutPartService.catatan.like(f"%{transaksi.nomor_transaksi}%")
        ).delete(synchronize_session=False)

        # 4. Re-calculate with new data
        customer = None
        if data.customer_id:
            customer = self._validate_customer(data.customer_id)

        # Validate spare parts
        spare_parts_map = self._validate_spare_parts(data.detail_parts)

        # Totals
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
                    transaksi_id=transaksi.id,
                    spare_part_id=item.spare_part_id,
                    qty=item.qty,
                    harga_beli=sp.harga_beli,
                    harga_jual=harga_jual,
                    subtotal=subtotal,
                )
            )

        total_jasa = Decimal("0")
        detail_services_records = []

        for item in data.detail_services:
            subtotal = item.harga * item.qty
            total_jasa += subtotal
            detail_services_records.append(
                DetailTransaksiServices(
                    transaksi_id=transaksi.id,
                    nama_jasa=item.nama_jasa,
                    deskripsi=item.deskripsi,
                    harga=item.harga,
                    qty=item.qty,
                    subtotal=subtotal,
                )
            )

        subtotal = total_parts + total_jasa
        grand_total = subtotal - data.diskon
        laba_kotor = grand_total - hpp_parts

        # Payments logic
        total_pembayaran = Decimal("0")
        metode_utama = data.metode_bayar
        
        is_internal_jasa_angkut = (data.kategori == "jasa_angkut")
        is_internal_mobil = (data.kategori == "jual_beli_mobil" and data.mobil_id)
        
        if is_internal_jasa_angkut:
            total_pembayaran = grand_total
            metode_utama = PaymentMethod.INTERNAL
        elif is_internal_mobil:
            total_pembayaran = Decimal("0")
            metode_utama = PaymentMethod.INTERNAL
        elif data.payments:
            total_pembayaran = sum(p.jumlah for p in data.payments)
            metodes = list(set(p.metode for p in data.payments if p.jumlah > 0))
            if len(metodes) > 1: metode_utama = PaymentMethod.SPLIT
            elif len(metodes) == 1: metode_utama = metodes[0]
        else:
            total_pembayaran = data.jumlah_bayar
            metode_utama = data.metode_bayar

        kembalian = Decimal("0")
        if total_pembayaran >= grand_total:
            kembalian = total_pembayaran - grand_total
            status_bayar = PaymentStatus.LUNAS
        elif total_pembayaran > 0:
            status_bayar = PaymentStatus.CICILAN
        else:
            status_bayar = PaymentStatus.BELUM_LUNAS

        # 5. Update main record
        transaksi.tanggal = data.tanggal
        transaksi.customer_id = data.customer_id
        transaksi.nama_customer = data.nama_customer or (customer.nama if customer else None)
        transaksi.nomor_plat = data.nomor_plat
        transaksi.jenis_kendaraan = data.jenis_kendaraan
        transaksi.kategori = data.kategori
        transaksi.muatan_id = data.muatan_id
        transaksi.armada_id = data.armada_id
        transaksi.mobil_id = data.mobil_id
        transaksi.total_parts = total_parts
        transaksi.total_jasa = total_jasa
        transaksi.subtotal = subtotal
        transaksi.diskon = data.diskon
        transaksi.grand_total = grand_total
        transaksi.hpp_parts = hpp_parts
        transaksi.laba_kotor = laba_kotor
        transaksi.status_bayar = status_bayar
        transaksi.metode_bayar = metode_utama
        transaksi.jumlah_bayar = total_pembayaran
        transaksi.kembalian = kembalian
        transaksi.catatan = data.catatan
        transaksi.detail_parts = detail_parts_records
        transaksi.detail_services = detail_services_records

        # 6. Apply stock & Re-create piutang / kas entries
        for item in data.detail_parts:
            sp = spare_parts_map[item.spare_part_id]
            if sp.stok != 999:
                sp.stok -= item.qty

        if status_bayar != PaymentStatus.LUNAS:
            debtor_name = transaksi.nama_customer or (customer.nama if customer else "Guest")
            if is_internal_mobil: debtor_name = f"JB MOBIL - {data.nomor_plat}"
            
            out_amount = grand_total
            new_piutang = PiutangUsaha(
                nomor_piutang=self._generate_nomor_piutang(),
                tanggal=data.tanggal,
                customer_id=data.customer_id,
                nama_debitur=debtor_name,
                 telepon_debitur=customer.telepon if customer else None,
                alamat_debitur=customer.alamat if customer else None,
                sumber=PiutangSource.BENGKEL,
                referensi_id=transaksi.id,
                nomor_referensi=transaksi.nomor_transaksi,
                nominal_piutang=grand_total,
                total_dibayar=Decimal("0"),
                sisa_piutang=grand_total,
                status=PiutangStatus.BELUM_LUNAS,
                catatan=f"Piutang Internal JB Mobil from (EDITED) {transaksi.nomor_transaksi}" if is_internal_mobil else f"Piutang from (EDITED) {transaksi.nomor_transaksi}",
                created_by=user_id,
            )
            self.db.add(new_piutang)
            self.db.flush() # Get ID for payment processing
            
            # Process DP if any
            if total_pembayaran > 0:
                from app.services.piutang_service import PiutangService
                from app.schemas.keuangan import PembayaranPiutangSplit
                
                p_service = PiutangService(self.db)
                payment_items = []
                if data.payments:
                    for p in data.payments:
                        if p.jumlah > 0:
                            payment_items.append({
                                "metode": p.metode,
                                "nominal": p.jumlah,
                                "catatan": "DP (EDITED) Bengkel"
                            })
                else:
                    payment_items.append({
                        "metode": data.metode_bayar,
                        "nominal": data.jumlah_bayar,
                        "catatan": "DP (EDITED) Bengkel"
                    })
                
                if payment_items:
                    p_service.process_payment_split(
                        PembayaranPiutangSplit(
                            piutang_id=new_piutang.id,
                            tanggal=data.tanggal,
                            payments=payment_items,
                            catatan=f"DP (EDITED) Transaksi {transaksi.nomor_transaksi}"
                        ),
                        user_id=user_id
                    )

        # Link entries (Mobil & Jasa Angkut)
        if transaksi.kategori == 'jual_beli_mobil' and transaksi.mobil_id:
             for detail in detail_parts_records:
                sp = spare_parts_map.get(detail.spare_part_id)
                self.db.add(MobilPartService(mobil_id=transaksi.mobil_id, tanggal=transaksi.tanggal, tipe='part', deskripsi=f"Sparepart: {sp.nama if sp else 'Part'}", qty=detail.qty, harga_satuan=detail.harga_jual, total=detail.subtotal, catatan=f"Trans Bengkel (EDIT): {transaksi.nomor_transaksi}"))
             for detail in detail_services_records:
                self.db.add(MobilPartService(mobil_id=transaksi.mobil_id, tanggal=transaksi.tanggal, tipe='service', deskripsi=f"Service: {detail.nama_jasa}", qty=detail.qty, harga_satuan=detail.harga, total=detail.subtotal, catatan=f"Trans Bengkel (EDIT): {transaksi.nomor_transaksi}"))

        if transaksi.kategori == 'jasa_angkut' and transaksi.muatan_id:
             for detail in detail_parts_records:
                sp = spare_parts_map.get(detail.spare_part_id)
                self.db.add(JasaAngkutPartService(muatan_id=transaksi.muatan_id, tanggal=transaksi.tanggal, tipe='part', deskripsi=f"Sparepart: {sp.nama if sp else 'Part'}", qty=detail.qty, harga_satuan=detail.harga_jual, total=detail.subtotal, catatan=f"Trans Bengkel (EDIT): {transaksi.nomor_transaksi}"))
             for detail in detail_services_records:
                self.db.add(JasaAngkutPartService(muatan_id=transaksi.muatan_id, tanggal=transaksi.tanggal, tipe='service', deskripsi=f"Service: {detail.nama_jasa}", qty=detail.qty, harga_satuan=detail.harga, total=detail.subtotal, catatan=f"Trans Bengkel (EDIT): {transaksi.nomor_transaksi}"))

        # KasBank Entries (Only for internal/integrated transactions)
        source_pocket = KasBankSource.BENGKEL
        if data.kategori == 'jasa_angkut': source_pocket = KasBankSource.JASA_ANGKUT
        elif data.kategori == 'jual_beli_mobil': source_pocket = KasBankSource.JUAL_BELI_MOBIL

        def record_bilateral_payment(amount, method, ref_id, ref_num):
            create_kas_entry(db=self.db, tanggal=data.tanggal, tipe=KasBankType.MASUK, nominal=amount, sumber=KasBankSource.BENGKEL, metode_bayar=method, referensi_id=ref_id, nomor_referensi=ref_num, keterangan=f"Pembayaran (EDIT: {method.upper()}) bengkel {ref_num}", user_id=user_id)
            if source_pocket != KasBankSource.BENGKEL:
                create_kas_entry(db=self.db, tanggal=data.tanggal, tipe=KasBankType.KELUAR, nominal=amount, sumber=source_pocket, metode_bayar=method, referensi_id=ref_id, nomor_referensi=ref_num, keterangan=f"Biaya Repair Internal (EDIT) via Bengkel: {ref_num}", user_id=user_id)

        if is_internal_jasa_angkut or is_internal_mobil:
            record_bilateral_payment(grand_total, PaymentMethod.INTERNAL, transaksi.id, transaksi.nomor_transaksi)

        self.db.commit()

        self.db.refresh(transaksi)
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
                joinedload(TransaksiPenjualanBengkel.muatan),
            )
            .filter(TransaksiPenjualanBengkel.id == transaksi_id)
            .first()
        )
        if not transaksi:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaksi tidak ditemukan",
            )
        
        # Add piutang info to the response
        piutang = (
            self.db.query(PiutangUsaha.id, PiutangUsaha.total_dibayar)
            .filter(
                PiutangUsaha.nomor_referensi == transaksi.nomor_transaksi,
                PiutangUsaha.sumber == PiutangSource.BENGKEL
            )
            .first()
        )
        if piutang:
            transaksi.piutang_id = piutang.id
            transaksi.jumlah_bayar = piutang.total_dibayar
        # No else needed, transaksi.jumlah_bayar already exists on the model
            
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
        mobil_id: Optional[int] = None,
        muatan_id: Optional[int] = None,
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
            joinedload(TransaksiPenjualanBengkel.detail_services),
            joinedload(TransaksiPenjualanBengkel.muatan)
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

        # Mobil filter
        if mobil_id:
            query = query.filter(TransaksiPenjualanBengkel.mobil_id == mobil_id)

        # Muatan filter
        if muatan_id:
            query = query.filter(TransaksiPenjualanBengkel.muatan_id == muatan_id)
            
        # Armada filter
        if getattr(self, 'armada_id', None) or (isinstance(muatan_id, int) is False and muatan_id is not None): # Fallback/Check
            pass # We rely on query params from caller passing armada_id if they want
        
        # New: direct armada_id filter if we added it to the model
        # I need to check if the caller can pass it.
        # Actually I didn't add it to list_transaksi params yet. 
        # But I can add it to the service method.


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
            TransaksiPenjualanBengkel, sort_by, TransaksiPenjualanBengkel.id
        )

        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        # Pagination
        transaksis = query.offset(skip).limit(limit).all()

        # Batch fetch piutang info for the current page
        if transaksis:
            nomor_refs = [t.nomor_transaksi for t in transaksis]
            piutang_info = self.db.query(
                PiutangUsaha.id, PiutangUsaha.nomor_referensi, PiutangUsaha.total_dibayar
            ).filter(
                PiutangUsaha.nomor_referensi.in_(nomor_refs),
                PiutangUsaha.sumber == PiutangSource.BENGKEL
            ).all()
            
            piutang_map = {p.nomor_referensi: (p.id, p.total_dibayar) for p in piutang_info}
            
            for t in transaksis:
                info = piutang_map.get(t.nomor_transaksi)
                if info:
                    t.piutang_id, t.jumlah_bayar = info

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
        search: Optional[str] = None,
        customer_id: Optional[int] = None,
        mobil_id: Optional[int] = None,
        muatan_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Get sales summary statistics with the same filters as get_list."""
        # Base query
        query = self.db.query(TransaksiPenjualanBengkel)

        # Apply the same filters as get_list for consistency
        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                or_(
                    TransaksiPenjualanBengkel.nomor_transaksi.ilike(search_filter),
                    TransaksiPenjualanBengkel.nama_customer.ilike(search_filter),
                    TransaksiPenjualanBengkel.nomor_plat.ilike(search_filter),
                )
            )
        if customer_id:
            query = query.filter(TransaksiPenjualanBengkel.customer_id == customer_id)
        if mobil_id:
            query = query.filter(TransaksiPenjualanBengkel.mobil_id == mobil_id)
        if muatan_id:
            query = query.filter(TransaksiPenjualanBengkel.muatan_id == muatan_id)
        if tanggal_dari:
            query = query.filter(TransaksiPenjualanBengkel.tanggal >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(TransaksiPenjualanBengkel.tanggal <= tanggal_sampai)

        total_count = query.count()
        
        # Payment status counts
        lunas_count = query.filter(TransaksiPenjualanBengkel.status_bayar == PaymentStatus.LUNAS).count()
        
        # Belum Lunas (Partial): Some paid, some unpaid
        belum_lunas_partial = query.filter(
            TransaksiPenjualanBengkel.status_bayar == PaymentStatus.BELUM_LUNAS,
            TransaksiPenjualanBengkel.jumlah_bayar > 0
        ).count()
        
        # Belum Bayar (Full Debt): Zero paid
        belum_bayar_full = query.filter(
            TransaksiPenjualanBengkel.status_bayar == PaymentStatus.BELUM_LUNAS,
            TransaksiPenjualanBengkel.jumlah_bayar == 0
        ).count()
        
        batal_count = query.filter(TransaksiPenjualanBengkel.status_bayar == PaymentStatus.BATAL).count()

        # Aggregate values (Excluding cancelled for financial totals)
        aggregates = query.filter(TransaksiPenjualanBengkel.status_bayar != PaymentStatus.BATAL).with_entities(
            func.sum(TransaksiPenjualanBengkel.grand_total).label("total_penjualan"),
            func.sum(TransaksiPenjualanBengkel.total_parts).label("total_parts"),
            func.sum(TransaksiPenjualanBengkel.total_jasa).label("total_jasa"),
            func.sum(TransaksiPenjualanBengkel.hpp_parts).label("total_hpp"),
            func.sum(TransaksiPenjualanBengkel.laba_kotor).label("total_laba"),
            func.sum(TransaksiPenjualanBengkel.diskon).label("total_diskon"),
            func.sum(case((TransaksiPenjualanBengkel.metode_bayar == PaymentMethod.INTERNAL, TransaksiPenjualanBengkel.grand_total), else_=0)).label("total_internal"),
        ).first()


        # Unpaid transactions (For Separated Stats)
        unpaid_query = query.filter(
            TransaksiPenjualanBengkel.status_bayar == PaymentStatus.BELUM_LUNAS
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

        # Status counts (Operational)
        status_counts = (
            self.db.query(
                TransaksiPenjualanBengkel.status_pengerjaan,
                func.count(TransaksiPenjualanBengkel.id)
            )
            .group_by(TransaksiPenjualanBengkel.status_pengerjaan)
            .all()
        )
        status_map = {s.name.lower() if hasattr(s, "name") else str(s).lower(): count for s, count in status_counts}

        # Payment type totals (Collected funds from Kas/Bank ledger)
        # This captures both direct sales and piutang settlements correctly.
        # We look for entries where source is BENGKEL or PIUTANG-from-Bengkel
        kas_income_query = self.db.query(KasBank).filter(
            KasBank.tipe == KasBankType.MASUK,
            or_(
                KasBank.sumber == KasBankSource.BENGKEL,
                KasBank.sumber == KasBankSource.PIUTANG
            )
        ).filter(~KasBank.keterangan.ilike("%Transfer dari KAS_UTAMA%"))

        if tanggal_dari:
            kas_income_query = kas_income_query.filter(KasBank.tanggal >= tanggal_dari)
        if tanggal_sampai:
            kas_income_query = kas_income_query.filter(KasBank.tanggal <= tanggal_sampai)

        payment_aggregates = kas_income_query.with_entities(
            func.sum(case((KasBank.metode_bayar == PaymentMethod.TUNAI, KasBank.nominal), else_=0)).label("total_tunai"),
            func.sum(case((KasBank.metode_bayar == PaymentMethod.TRANSFER, KasBank.nominal), else_=0)).label("total_transfer"),
            func.sum(case((KasBank.metode_bayar == PaymentMethod.INTERNAL, KasBank.nominal), else_=0)).label("total_internal"),
        ).first()

        # Manual Inflows/Outflows from KasBank (excluding automated BENGKEL sales to avoid double counting)
        kas_query = self.db.query(KasBank).filter(
            KasBank.jenis == KasBankJenis.KAS_UNIT_BENGKEL
        )
        if tanggal_dari:
            kas_query = kas_query.filter(KasBank.tanggal >= tanggal_dari)
        if tanggal_sampai:
            kas_query = kas_query.filter(KasBank.tanggal <= tanggal_sampai)
            
        manual_inflow = (
            kas_query.filter(
                KasBank.tipe == KasBankType.MASUK,
                KasBank.sumber != KasBankSource.BENGKEL
            ).with_entities(func.sum(KasBank.nominal)).scalar() or Decimal("0")
        )

        # Funds specifically from KAS_UTAMA
        dana_dari_utama = (
            kas_query.filter(
                KasBank.tipe == KasBankType.MASUK,
                KasBank.keterangan.ilike("%Transfer dari KAS_UTAMA%")
            ).with_entities(func.sum(KasBank.nominal)).scalar() or Decimal("0")
        )
        
        manual_outflow = (
            kas_query.filter(
                KasBank.tipe == KasBankType.KELUAR
            ).with_entities(func.sum(KasBank.nominal)).scalar() or Decimal("0")
        )

        return {
            "total_transaksi": total_count,
            "lunas_count": lunas_count,
            "belum_lunas_count": belum_lunas_partial,
            "belum_bayar_count": belum_bayar_full,
            "batal_count": batal_count,
            "antre": status_map.get("antre", 0),
            "proses": status_map.get("proses", 0),
            "selesai": status_map.get("selesai", 0),
            "total_penjualan": float(aggregates.total_penjualan or 0),
            "total_parts": float(aggregates.total_parts or 0),
            "total_jasa": float(aggregates.total_jasa or 0),
            "total_diskon": float(aggregates.total_diskon or 0),
            "total_hpp": float(aggregates.total_hpp or 0),
            "total_laba_kotor": float(aggregates.total_laba or 0),
            "total_tunai": float(payment_aggregates.total_tunai or 0),
            "total_transfer": float(payment_aggregates.total_transfer or 0),
            "total_internal": float(aggregates.total_internal or 0),
            "total_dana_masuk": float(manual_inflow),
            "total_dana_dari_utama": float(dana_dari_utama),
            "total_dana_keluar": float(manual_outflow),
            "piutang_count": unpaid_count,
            "piutang_nilai": float(unpaid_value),
        }


    def get_daily_summary(self, tanggal: date) -> Dict[str, Any]:
        """Get daily sales summary."""
        from app.models.mobil import Mobil
        from app.utils.constants import CarStatus

        query = self.db.query(TransaksiPenjualanBengkel).filter(
            TransaksiPenjualanBengkel.tanggal == tanggal
        )

        # Internal jual_beli_mobil transactions included (HPP recognized immediately).

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

        # 1. Restore spare part stock
        for detail in transaksi.detail_parts:
            spare_part = (
                self.db.query(SparePart)
                .filter(SparePart.id == detail.spare_part_id)
                .first()
            )
            if spare_part and spare_part.stok != 999:
                spare_part.stok += detail.qty

        # 2. Void related Piutang
        piutang = (
            self.db.query(PiutangUsaha)
            .filter(
                PiutangUsaha.nomor_referensi == transaksi.nomor_transaksi,
                PiutangUsaha.sumber == PiutangSource.BENGKEL,
            )
            .first()
        )

        # 3. Delete related KasBank entries (Financial Balance)
        # Direct payments
        self.db.query(KasBank).filter(
            KasBank.referensi_id == transaksi.id,
            KasBank.sumber == KasBankSource.BENGKEL,
        ).delete(synchronize_session=False)

        # Piutang and its payments
        if piutang:
            # Delete payments entries in KasBank for this Piutang
            pembayaran_ids = [p.id for p in piutang.pembayaran]
            if pembayaran_ids:
                self.db.query(KasBank).filter(
                    KasBank.referensi_id.in_(pembayaran_ids),
                    or_(KasBank.sumber == KasBankSource.PIUTANG, KasBank.sumber == KasBankSource.BENGKEL)
                ).delete(synchronize_session=False)

            
            # Additional check for payments by nomor_referensi
            self.db.query(KasBank).filter(
                KasBank.nomor_referensi == piutang.nomor_piutang
            ).delete(synchronize_session=False)
            
            # Set Piutang status to BATAL instead of deleting
            piutang.status = PiutangStatus.BATAL
            piutang.sisa = 0

        # 4. Remove linked costs (Mobil & Jasa Angkut)
        self.db.query(MobilPartService).filter(
            MobilPartService.catatan.like(f"%{transaksi.nomor_transaksi}%")
        ).delete(synchronize_session=False)

        self.db.query(JasaAngkutPartService).filter(
            JasaAngkutPartService.catatan.like(f"%{transaksi.nomor_transaksi}%")
        ).delete(synchronize_session=False)

        # 5. VOID Transaction instead of deleting
        transaksi.status_pengerjaan = WorkshopStatus.BATAL
        transaksi.status_bayar = PaymentStatus.BATAL
        
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
