from datetime import datetime, date
from decimal import Decimal
import secrets
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
from app.models.keuangan import PiutangUsaha, HutangUsaha, KasBank, PembayaranPiutang
from app.models.mobil import MobilPartService, Mobil
from app.models.jasa_angkut import JasaAngkutPartService
from app.schemas.bengkel import DetailPartCreate, DetailServiceCreate, TransaksiBengkelCreate, PaymentItem
from app.realtime import publish_realtime_event
from app.utils.helpers import get_jakarta_date
from app.utils.sparepart_stock import ALWAYS_READY_STOCK, is_always_ready_stock
from app.utils.constants import (
    PaymentStatus,
    PaymentMethod,
    PiutangStatus,
    PiutangSource,
    HutangStatus,
    HutangSource,
    TRANSACTION_PREFIXES,
    WorkshopStatus,
    KasBankType,
    KasBankSource,
    KasBankJenis,
    CarStatus,
)
from app.services.kas_bank_integration import create_kas_entry


class TransaksiBengkelService:
    """Service for workshop sales transactions."""

    INTERNAL_KATEGORI = ("jasa_angkut", "jual_beli_mobil")

    def __init__(self, db: Session):
        self.db = db

    @classmethod
    def _is_internal_kategori(cls, kategori: Optional[str]) -> bool:
        return (kategori or "umum") in cls.INTERNAL_KATEGORI

    @classmethod
    def _resolve_status_bayar(
        cls,
        kategori: Optional[str],
        grand_total: Decimal,
        jumlah_bayar: Decimal,
    ) -> tuple[PaymentStatus, Decimal]:
        """Resolve customer-facing payment status. Internal unit transfers skip tunai flow."""
        if cls._is_internal_kategori(kategori):
            return PaymentStatus.INTERNAL, Decimal("0")

        kembalian = Decimal("0")
        if grand_total <= 0:
            return PaymentStatus.LUNAS, jumlah_bayar
        if jumlah_bayar >= grand_total:
            kembalian = jumlah_bayar - grand_total
            return PaymentStatus.LUNAS, kembalian
        if jumlah_bayar > 0:
            return PaymentStatus.CICILAN, kembalian
        return PaymentStatus.BELUM_LUNAS, kembalian

    def _emit_change(self, transaksi: TransaksiPenjualanBengkel, action: str) -> None:
        scopes = {"bengkel"}
        if transaksi.kategori == "jasa_angkut":
            scopes.add("jasa_angkut")
        elif transaksi.kategori == "jual_beli_mobil":
            scopes.add("mobil")

        for scope in scopes:
            publish_realtime_event(
                event=f"{scope}.transaction.{action}",
                scope=scope,
                entity="transaksi_bengkel",
                action=action,
                entity_id=transaksi.id,
                data={
                    "nomor_transaksi": transaksi.nomor_transaksi,
                    "kategori": transaksi.kategori,
                },
            )

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

    def settle_internal_debts_for_transaksi(
        self,
        nomor_transaksi: str,
        *,
        user_id: Optional[int] = None,
        note: str = "",
    ) -> None:
        """Mark internal piutang/hutang as settled without touching unit cash wallets."""
        suffix = f" | {note}" if note else ""

        piutang_rows = (
            self.db.query(PiutangUsaha)
            .filter(
                PiutangUsaha.nomor_referensi == nomor_transaksi,
                PiutangUsaha.is_internal == True,
                PiutangUsaha.status != PiutangStatus.BATAL,
            )
            .all()
        )
        for piutang in piutang_rows:
            piutang.status = PiutangStatus.LUNAS
            piutang.total_dibayar = piutang.nominal_piutang
            piutang.sisa_piutang = Decimal("0")
            if not piutang.tanggal_lunas:
                piutang.tanggal_lunas = date.today()
            if suffix and suffix not in (piutang.catatan or ""):
                piutang.catatan = (piutang.catatan or "") + suffix

        hutang_rows = (
            self.db.query(HutangUsaha)
            .filter(
                HutangUsaha.nomor_referensi == nomor_transaksi,
                HutangUsaha.is_internal == True,
                HutangUsaha.status != HutangStatus.BATAL,
            )
            .all()
        )
        for hutang in hutang_rows:
            hutang.status = HutangStatus.LUNAS
            hutang.total_dibayar = hutang.nominal_hutang
            hutang.sisa_hutang = Decimal("0")
            if suffix and suffix not in (hutang.catatan or ""):
                hutang.catatan = (hutang.catatan or "") + suffix

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
        transaksi_tanggal = get_jakarta_date()

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

        requested_work_status = getattr(data, "status_pengerjaan", None) or WorkshopStatus.ANTRE
        has_upfront_payment = bool(
            (data.payments and any(p.jumlah > 0 for p in data.payments)) or
            (data.jumlah_bayar and data.jumlah_bayar > 0)
        )
        should_finalize_finance = (
            grand_total > 0
            or has_upfront_payment
            or requested_work_status == WorkshopStatus.SELESAI
        )

        # Calculate summary of payments
        total_pembayaran = Decimal("0")
        metode_utama = data.metode_bayar
        
        # For jasa_angkut / jual_beli_mobil: payment method is INTERNAL
        # Cost is deducted from Laba TPM (jasa_angkut) or added to HPP (mobil)
        kategori = getattr(data, "kategori", "umum") or "umum"
        is_internal_jasa_angkut = kategori == "jasa_angkut"
        is_internal_mobil = kategori == "jual_beli_mobil"
        is_internal = is_internal_jasa_angkut or is_internal_mobil

        if is_internal:
            # Internal JA/JBM: hutang/piutang antar unit — tidak ada alur tunai pelanggan.
            total_pembayaran = Decimal("0")
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

        status_bayar, kembalian = self._resolve_status_bayar(
            kategori,
            grand_total,
            total_pembayaran,
        )

        # Customer name from customer record or input
        nama_customer = data.nama_customer
        if customer and not nama_customer:
            nama_customer = customer.nama

        # Create transaction record
        transaksi = TransaksiPenjualanBengkel(
            nomor_transaksi=nomor_transaksi,
            public_receipt_token=secrets.token_urlsafe(32),
            tanggal=transaksi_tanggal,
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
            tampilkan_diskon_struk=(
                True if getattr(data, "tampilkan_diskon_struk", None) is None
                else bool(data.tampilkan_diskon_struk)
            ),
            hpp_parts=hpp_parts,
            laba_kotor=laba_kotor,
            status_bayar=status_bayar,
            status_pengerjaan=requested_work_status,
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
            if not is_always_ready_stock(sp.stok):
                sp.stok -= item.qty

        # Create piutang if not fully paid (external) or internal unit transfer
        if should_finalize_finance and grand_total > 0 and (
            is_internal or status_bayar not in (PaymentStatus.LUNAS,)
        ):
            debtor_name = nama_customer or (customer.nama if customer else "Guest")
            if is_internal_mobil:
                debtor_name = f"JB MOBIL - {data.nomor_plat}"
            elif is_internal_jasa_angkut:
                debtor_name = nama_customer or f"Armada {data.nomor_plat}"

            if is_internal_jasa_angkut:
                piutang_sumber = PiutangSource.JASA_ANGKUT
                piutang_catatan = f"Piutang Internal Jasa Angkut dari transaksi bengkel {nomor_transaksi}"
            elif is_internal_mobil:
                piutang_sumber = PiutangSource.JUAL_BELI_MOBIL
                piutang_catatan = f"Piutang Internal JB Mobil dari transaksi bengkel {nomor_transaksi}"
            else:
                piutang_sumber = PiutangSource.BENGKEL
                piutang_catatan = f"Piutang dari transaksi bengkel {nomor_transaksi}"

            out_amount = grand_total
            piutang = PiutangUsaha(
                nomor_piutang=self._generate_nomor_piutang(),
                tanggal=transaksi_tanggal,
                customer_id=customer.id if customer else None,
                nama_debitur=debtor_name,
                telepon_debitur=customer.telepon if customer else None,
                alamat_debitur=customer.alamat if customer else None,
                nominal_piutang=out_amount,
                sumber=piutang_sumber,
                unit=KasBankSource.BENGKEL,
                is_internal=is_internal_mobil or is_internal_jasa_angkut,
                referensi_id=None,
                nomor_referensi=nomor_transaksi,
                total_dibayar=Decimal("0"),
                sisa_piutang=out_amount,
                status=PiutangStatus.BELUM_LUNAS,
                catatan=piutang_catatan,
                created_by=user_id,
            )
            self.db.add(piutang)


        self.db.commit()
        self.db.refresh(transaksi)

        # Update Piutang's referensi_id, create internal hutang, or process DP
        if should_finalize_finance and (is_internal_mobil or is_internal_jasa_angkut or total_pembayaran > 0):
            piutang_sumber = (
                PiutangSource.JUAL_BELI_MOBIL if is_internal_mobil
                else PiutangSource.JASA_ANGKUT if is_internal_jasa_angkut
                else PiutangSource.BENGKEL
            )
            piutang_record = self.db.query(PiutangUsaha).filter(
                PiutangUsaha.nomor_referensi == nomor_transaksi,
                PiutangUsaha.sumber == piutang_sumber
            ).first()
            if piutang_record:
                piutang_record.referensi_id = transaksi.id

                if is_internal_mobil:
                    new_hutang = HutangUsaha(
                        nomor_hutang=self._generate_nomor_hutang(),
                        tanggal=transaksi_tanggal,
                        nama_kreditur="BENGKEL TPM",
                        nominal_hutang=grand_total,
                        sisa_hutang=grand_total,
                        total_dibayar=Decimal("0"),
                        status=HutangStatus.BELUM_LUNAS,
                        sumber=HutangSource.JUAL_BELI_MOBIL,
                        unit=KasBankSource.JUAL_BELI_MOBIL,
                        is_internal=True,
                        referensi_id=transaksi.id,
                        nomor_referensi=nomor_transaksi,
                        catatan=f"Hutang Internal Repair Mobil {data.nomor_plat} dari bengkel {nomor_transaksi}",
                        created_by=user_id
                    )
                    self.db.add(new_hutang)
                elif is_internal_jasa_angkut:
                    existing_hutang = self.db.query(HutangUsaha).filter(
                        HutangUsaha.nomor_referensi == nomor_transaksi,
                        HutangUsaha.is_internal == True,
                    ).first()
                    if not existing_hutang:
                        new_hutang = HutangUsaha(
                            nomor_hutang=self._generate_nomor_hutang(),
                            tanggal=transaksi_tanggal,
                            nama_kreditur="BENGKEL TPM",
                            nominal_hutang=grand_total,
                            sisa_hutang=grand_total,
                            total_dibayar=Decimal("0"),
                            status=HutangStatus.BELUM_LUNAS,
                            sumber=HutangSource.LAINNYA,
                            unit=KasBankSource.JASA_ANGKUT,
                            is_internal=True,
                            referensi_id=transaksi.id,
                            nomor_referensi=nomor_transaksi,
                            catatan=f"Hutang Internal Repair Armada {data.nomor_plat} dari bengkel {nomor_transaksi}",
                            created_by=user_id,
                        )
                        self.db.add(new_hutang)
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
                                tanggal=transaksi_tanggal,
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
            if amount <= 0:
                return
            # MASUK to Workshop
            create_kas_entry(
                db=self.db, tanggal=transaksi_tanggal, tipe=KasBankType.MASUK,
                nominal=amount, sumber=KasBankSource.BENGKEL, metode_bayar=method,
                referensi_id=ref_id, nomor_referensi=ref_num,
                keterangan=f"Pembayaran ({method.upper()}) bengkel {ref_num}",
                user_id=user_id,
            )
            # KELUAR from Unit (if internal/integrated)
            if source_pocket != KasBankSource.BENGKEL:
                create_kas_entry(
                    db=self.db, tanggal=transaksi_tanggal, tipe=KasBankType.KELUAR,
                    nominal=amount, sumber=source_pocket, metode_bayar=method,
                    referensi_id=ref_id, nomor_referensi=ref_num,
                    keterangan=f"Biaya Repair Internal via Bengkel: {ref_num}",
                    user_id=user_id,
                    allow_negative=True,
                )

        # Handle DP Prepayment (grand_total = 0, but customer paid DP)
        # Record kas entry for the DP amount
        if should_finalize_finance and not is_internal_mobil and not is_internal_jasa_angkut and total_pembayaran > 0 and grand_total == 0:
            if data.payments:
                for p in data.payments:
                    if p.jumlah > 0:
                        create_kas_entry(
                            db=self.db, tanggal=transaksi_tanggal, tipe=KasBankType.MASUK,
                            nominal=p.jumlah, sumber=KasBankSource.BENGKEL,
                            metode_bayar=p.metode,
                            referensi_id=transaksi.id, nomor_referensi=nomor_transaksi,
                            keterangan=f"DP Bengkel: {nomor_transaksi} ({p.metode})",
                            user_id=user_id,
                            kas_jenis=p.kas_jenis,
                        )
            else:
                create_kas_entry(
                    db=self.db, tanggal=transaksi_tanggal, tipe=KasBankType.MASUK,
                    nominal=total_pembayaran, sumber=KasBankSource.BENGKEL,
                    metode_bayar=metode_utama,
                    referensi_id=transaksi.id, nomor_referensi=nomor_transaksi,
                    keterangan=f"DP Bengkel: {nomor_transaksi}",
                    user_id=user_id,
                )

        # Internal JA: no bilateral kas — biaya tercatat via hutang/piutang internal saja.

        # 2. Handle Non-Internal (UMUM) LUNAS Transactions 
        # (Internal Mobil and non-internal partial payments are already handled via Piutang system)
        elif should_finalize_finance and not is_internal_mobil and status_bayar == PaymentStatus.LUNAS:
            if total_pembayaran > 0:
                # Record payments capped at grand_total (excess is 'kembalian')
                remaining_to_record = grand_total
                if data.payments:
                    for p in data.payments:
                        if remaining_to_record <= 0:
                            break
                        rec_amount = min(p.jumlah, remaining_to_record)
                        if rec_amount > 0:
                            create_kas_entry(
                                db=self.db, tanggal=transaksi_tanggal, tipe=KasBankType.MASUK,
                                nominal=rec_amount, sumber=KasBankSource.BENGKEL,
                                metode_bayar=p.metode,
                                referensi_id=transaksi.id, nomor_referensi=nomor_transaksi,
                                keterangan=f"Pembayaran Bengkel: {nomor_transaksi} ({p.metode})",
                                user_id=user_id,
                                kas_jenis=p.kas_jenis,
                            )
                            remaining_to_record -= rec_amount
                else:
                    # Single payment
                    create_kas_entry(
                        db=self.db, tanggal=transaksi_tanggal, tipe=KasBankType.MASUK,
                        nominal=grand_total, sumber=KasBankSource.BENGKEL,
                        metode_bayar=metode_utama,
                        referensi_id=transaksi.id, nomor_referensi=nomor_transaksi,
                        keterangan=f"Pembayaran Lunas Bengkel: {nomor_transaksi}",
                        user_id=user_id,
                    )

        self.db.commit()
        self._emit_change(transaksi, "created")
        return transaksi

    def update(
        self,
        transaksi_id: int,
        data: Any, # Use any since we handle mixed schemas
        user_id: Optional[int] = None,
    ) -> TransaksiPenjualanBengkel:
        """Update an existing workshop transaction."""
        transaksi = self.get_by_id(transaksi_id)
        effective_tanggal = data.tanggal or transaksi.tanggal
        original_jumlah_bayar = transaksi.jumlah_bayar

        # 1. Restore stock
        for detail in transaksi.detail_parts:
            sp = self.db.query(SparePart).filter(SparePart.id == detail.spare_part_id).first()
            if sp and not is_always_ready_stock(sp.stok):
                sp.stok += detail.qty

        # 2. Delete old details
        self.db.query(DetailTransaksiSpareParts).filter(DetailTransaksiSpareParts.transaksi_id == transaksi_id).delete(synchronize_session=False)
        self.db.query(DetailTransaksiServices).filter(DetailTransaksiServices.transaksi_id == transaksi_id).delete(synchronize_session=False)

        # 3. Delete old link entries (Mobil/JA) — recreated below
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

        requested_work_status = data.status_pengerjaan or transaksi.status_pengerjaan

        kategori = data.kategori or transaksi.kategori or "umum"
        is_internal = self._is_internal_kategori(kategori)
        preserved_jumlah_bayar = Decimal("0") if is_internal else transaksi.jumlah_bayar

        status_bayar, kembalian = self._resolve_status_bayar(
            kategori,
            grand_total,
            preserved_jumlah_bayar,
        )

        # 5. Update main record
        transaksi.tanggal = effective_tanggal
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
        if getattr(data, "tampilkan_diskon_struk", None) is not None:
            transaksi.tampilkan_diskon_struk = bool(data.tampilkan_diskon_struk)
        transaksi.hpp_parts = hpp_parts
        transaksi.laba_kotor = laba_kotor
        transaksi.status_bayar = status_bayar
        if is_internal:
            transaksi.metode_bayar = PaymentMethod.INTERNAL
            transaksi.jumlah_bayar = Decimal("0")
            transaksi.kembalian = Decimal("0")
        transaksi.status_pengerjaan = requested_work_status
        transaksi.catatan = data.catatan
        transaksi.detail_parts = detail_parts_records
        transaksi.detail_services = detail_services_records

        # 6. Apply stock
        for item in data.detail_parts:
            sp = spare_parts_map[item.spare_part_id]
            if not is_always_ready_stock(sp.stok):
                sp.stok -= item.qty

        # Create piutang only if none exists (first time CICILAN after update)
        existing_piutang = self.db.query(PiutangUsaha).filter(
            PiutangUsaha.nomor_referensi == transaksi.nomor_transaksi,
            PiutangUsaha.sumber == PiutangSource.BENGKEL
        ).first()
        is_not_internal = not self._is_internal_kategori(kategori)
        should_invoice_finance = grand_total > 0
        if (
            not existing_piutang
            and should_invoice_finance
            and status_bayar in (PaymentStatus.CICILAN, PaymentStatus.BELUM_LUNAS)
            and is_not_internal
        ):
            debtor_name = transaksi.nama_customer or "Guest"
            new_piutang = PiutangUsaha(
                nomor_piutang=self._generate_nomor_piutang(),
                tanggal=effective_tanggal,
                customer_id=data.customer_id,
                nama_debitur=debtor_name,
                telepon_debitur=customer.telepon if customer else None,
                alamat_debitur=customer.alamat if customer else None,
                sumber=PiutangSource.BENGKEL,
                referensi_id=transaksi.id,
                nomor_referensi=transaksi.nomor_transaksi,
                nominal_piutang=grand_total,
                total_dibayar=transaksi.jumlah_bayar,
                sisa_piutang=max(Decimal("0"), grand_total - transaksi.jumlah_bayar),
                status=(
                    PiutangStatus.SEBAGIAN
                    if (transaksi.jumlah_bayar or 0) > 0
                    else PiutangStatus.BELUM_LUNAS
                ),
                catatan=f"Piutang from {transaksi.nomor_transaksi}",
                is_internal=False,
                unit=KasBankSource.BENGKEL,
                created_by=user_id,
            )
            self.db.add(new_piutang)
        elif existing_piutang:
            existing_piutang.nominal_piutang = grand_total
            existing_piutang.total_dibayar = transaksi.jumlah_bayar
            existing_piutang.sisa_piutang = max(Decimal("0"), grand_total - transaksi.jumlah_bayar)
            # Update status based on payment completion
            if existing_piutang.sisa_piutang <= 0:
                existing_piutang.status = PiutangStatus.LUNAS
                existing_piutang.tanggal_lunas = date.today()
            elif existing_piutang.total_dibayar > 0:
                existing_piutang.status = PiutangStatus.SEBAGIAN
            else:
                existing_piutang.status = PiutangStatus.BELUM_LUNAS

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

        self.db.commit()
        self.db.refresh(transaksi)
        self._emit_change(transaksi, "updated")
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
        if skip == 0:
            from app.services.penjualan_mobil_service import PenjualanMobilService

            PenjualanMobilService(self.db).reconcile_unsettled_workshop_for_sold_mobils()

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
        exclude_sold_internal_jbm: bool = False,
        financial_only: bool = False,
    ) -> Dict[str, Any]:
        """Get sales summary statistics with the same filters as get_list."""
        from app.services.penjualan_mobil_service import PenjualanMobilService

        PenjualanMobilService(self.db).reconcile_unsettled_workshop_for_sold_mobils()

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
        if financial_only:
            query = query.filter(
                TransaksiPenjualanBengkel.grand_total > 0,
                TransaksiPenjualanBengkel.status_bayar != PaymentStatus.BATAL,
            )

        if exclude_sold_internal_jbm:
            # Keep the Bengkel queue UI summary consistent with its hidden list:
            # internal workshop orders for jual-beli mobil disappear once the
            # car has been sold. Financial reports keep them to consolidate
            # internal revenue/cost correctly.
            query = query.outerjoin(
                Mobil,
                TransaksiPenjualanBengkel.mobil_id == Mobil.id,
            ).filter(
                or_(
                    TransaksiPenjualanBengkel.kategori != "jual_beli_mobil",
                    TransaksiPenjualanBengkel.mobil_id.is_(None),
                    Mobil.status != CarStatus.TERJUAL,
                    Mobil.status.is_(None),
                )
            )

        total_count = query.count()
        
        external_only = TransaksiPenjualanBengkel.kategori.notin_(self.INTERNAL_KATEGORI)

        # Payment status counts (umum saja — internal JA/JBM tidak masuk alur tunai)
        lunas_count = query.filter(
            external_only,
            TransaksiPenjualanBengkel.status_bayar == PaymentStatus.LUNAS,
        ).count()

        belum_lunas_partial = query.filter(
            external_only,
            TransaksiPenjualanBengkel.status_bayar == PaymentStatus.BELUM_LUNAS,
            TransaksiPenjualanBengkel.jumlah_bayar > 0,
        ).count()

        belum_bayar_full = query.filter(
            external_only,
            TransaksiPenjualanBengkel.status_bayar == PaymentStatus.BELUM_LUNAS,
            TransaksiPenjualanBengkel.jumlah_bayar == 0,
        ).count()

        internal_count = query.filter(
            TransaksiPenjualanBengkel.status_bayar == PaymentStatus.INTERNAL,
        ).count()
        
        batal_count = query.filter(TransaksiPenjualanBengkel.status_bayar == PaymentStatus.BATAL).count()

        # Aggregate values (Excluding cancelled for financial totals)
        aggregates = query.filter(TransaksiPenjualanBengkel.status_bayar != PaymentStatus.BATAL).with_entities(
            func.sum(TransaksiPenjualanBengkel.grand_total).label("total_penjualan"),
            func.sum(TransaksiPenjualanBengkel.subtotal).label("total_subtotal"),
            func.sum(TransaksiPenjualanBengkel.total_parts).label("total_parts"),
            func.sum(TransaksiPenjualanBengkel.total_jasa).label("total_jasa"),
            func.sum(TransaksiPenjualanBengkel.hpp_parts).label("total_hpp"),
            func.sum(TransaksiPenjualanBengkel.laba_kotor).label("total_laba"),
            func.sum(TransaksiPenjualanBengkel.diskon).label("total_diskon"),
            func.sum(case((TransaksiPenjualanBengkel.metode_bayar == PaymentMethod.INTERNAL, TransaksiPenjualanBengkel.grand_total), else_=0)).label("total_internal"),
        ).first()


        # Unpaid transactions (external customers only)
        unpaid_query = query.filter(
            external_only,
            TransaksiPenjualanBengkel.status_bayar == PaymentStatus.BELUM_LUNAS,
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
            query.with_entities(
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
            "internal_count": internal_count,
            "antre": status_map.get("antre", 0),
            "proses": status_map.get("proses", 0),
            "selesai": status_map.get("selesai", 0),
            "total_penjualan": float(aggregates.total_penjualan or 0),
            "total_subtotal": float(aggregates.total_subtotal or 0),
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
            TransaksiPenjualanBengkel.tanggal == tanggal,
            TransaksiPenjualanBengkel.grand_total > 0,
            TransaksiPenjualanBengkel.status_pengerjaan == WorkshopStatus.SELESAI,
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
        diskon: Optional[Decimal] = None,
        payments: Optional[List[PaymentItem]] = None,
        status_pengerjaan: Optional[WorkshopStatus] = None,
        kas_jenis: Optional[KasBankJenis] = None,
    ) -> TransaksiPenjualanBengkel:
        """Update payment for a transaction.

        Supports: diskon adjustment, split payments (payments list),
        and auto-update status_pengerjaan to SELESAI.
        """
        transaksi = self.get_by_id(transaksi_id)

        if self._is_internal_kategori(transaksi.kategori):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transaksi internal (Jasa Angkut / Jual Beli Mobil) tidak memiliki alur pembayaran tunai",
            )

        if transaksi.status_bayar == PaymentStatus.LUNAS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transaksi sudah lunas",
            )

        # Apply discount if provided
        if diskon is not None and diskon > 0:
            transaksi.diskon = (transaksi.diskon or Decimal("0")) + diskon
            new_grand_total = transaksi.subtotal - transaksi.diskon
            if new_grand_total < 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Diskon melebihi subtotal",
                )
            transaksi.grand_total = new_grand_total

        # Determine effective payment amount & method
        effective_payment = jumlah_bayar
        effective_method = metode_bayar or transaksi.metode_bayar

        # Handle split payments
        if payments and len(payments) > 0:
            total_from_payments = sum(p.jumlah for p in payments)
            if total_from_payments > 0:
                methods = list(set(p.metode for p in payments if p.jumlah > 0))
                effective_method = PaymentMethod.SPLIT if len(methods) > 1 else methods[0]
                # Use the total from payments instead of jumlah_bayar
                # jumlah_bayar in this context is total being paid NOW
                # But if caller passed both, payments takes precedence
                if total_from_payments != effective_payment:
                    # payments list is the source of truth
                    pass  # keep effective_payment as-is, or override:
            # Record each split payment to kas/bank
            for p in payments:
                if p.jumlah > 0:
                    create_kas_entry(
                        db=self.db,
                        tanggal=date.today(),
                        tipe=KasBankType.MASUK,
                        nominal=p.jumlah,
                        sumber=KasBankSource.BENGKEL,
                        metode_bayar=p.metode or effective_method,
                        referensi_id=transaksi.id,
                        nomor_referensi=transaksi.nomor_transaksi,
                        keterangan=f"Pembayaran bengkel {transaksi.nomor_transaksi} ({p.metode.value})",
                        user_id=user_id,
                        kas_jenis=p.kas_jenis,
                    )

        # Update payment
        total_bayar = transaksi.jumlah_bayar + effective_payment
        sisa = transaksi.grand_total - total_bayar

        if sisa <= 0:
            transaksi.status_bayar = PaymentStatus.LUNAS
            transaksi.kembalian = abs(sisa)
        else:
            transaksi.status_bayar = PaymentStatus.CICILAN

        transaksi.jumlah_bayar = total_bayar
        if effective_method:
            transaksi.metode_bayar = effective_method

        # Update status_pengerjaan if provided
        if status_pengerjaan:
            transaksi.status_pengerjaan = status_pengerjaan

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
            piutang.total_dibayar = transaksi.jumlah_bayar
            piutang.sisa_piutang = max(sisa, Decimal("0"))
            if sisa <= 0:
                piutang.status = PiutangStatus.LUNAS
                piutang.tanggal_lunas = date.today()
            else:
                piutang.status = PiutangStatus.SEBAGIAN

        # Clear DP liability (uang muka penjualan) when transaction reaches LUNAS
        if transaksi.status_bayar == PaymentStatus.LUNAS:
            self.db.query(HutangUsaha).filter(
                HutangUsaha.nomor_referensi == transaksi.nomor_transaksi,
                HutangUsaha.sumber == HutangSource.UANG_MUKA_PENJUALAN
            ).delete(synchronize_session=False)

        self.db.commit()
        self.db.refresh(transaksi)

        # Record single payment to kas/bank (if no split payments recorded above)
        if not payments and effective_payment > 0:
            # Use explicit kas_jenis from request if provided
            kas_jenis_value = kas_jenis
            create_kas_entry(
                db=self.db,
                tanggal=date.today(),
                tipe=KasBankType.MASUK,
                nominal=effective_payment,
                sumber=KasBankSource.BENGKEL,
                metode_bayar=effective_method,
                referensi_id=transaksi.id,
                nomor_referensi=transaksi.nomor_transaksi,
                keterangan=f"Pembayaran bengkel {transaksi.nomor_transaksi}",
                user_id=user_id,
                kas_jenis=kas_jenis_value,
            )

        self._emit_change(transaksi, "payment_updated")
        return transaksi

    def update_status(
        self,
        transaksi_id: int,
        status: WorkshopStatus,
        user_id: Optional[int] = None,
    ) -> TransaksiPenjualanBengkel:
        """Update working status for a transaction."""
        transaksi = self.get_by_id(transaksi_id)

        if status == WorkshopStatus.SELESAI and transaksi.status_pengerjaan != WorkshopStatus.SELESAI:
            data = TransaksiBengkelCreate(
                tanggal=transaksi.tanggal,
                customer_id=transaksi.customer_id,
                nama_customer=transaksi.nama_customer,
                nomor_plat=transaksi.nomor_plat,
                jenis_kendaraan=transaksi.jenis_kendaraan,
                kategori=transaksi.kategori,
                muatan_id=transaksi.muatan_id,
                armada_id=transaksi.armada_id,
                mobil_id=transaksi.mobil_id,
                detail_parts=[
                    DetailPartCreate(
                        spare_part_id=detail.spare_part_id,
                        qty=detail.qty,
                        harga_jual=detail.harga_jual,
                    )
                    for detail in transaksi.detail_parts
                ],
                detail_services=[
                    DetailServiceCreate(
                        nama_jasa=detail.nama_jasa,
                        deskripsi=detail.deskripsi,
                        harga=detail.harga,
                        qty=detail.qty,
                    )
                    for detail in transaksi.detail_services
                ],
                diskon=transaksi.diskon,
                tampilkan_diskon_struk=bool(getattr(transaksi, "tampilkan_diskon_struk", True)),
                metode_bayar=transaksi.metode_bayar,
                jumlah_bayar=transaksi.jumlah_bayar,
                payments=[],
                status_pengerjaan=status,
                catatan=transaksi.catatan,
            )
            return self.update(transaksi_id, data, user_id=user_id)

        transaksi.status_pengerjaan = status
        
        self.db.commit()
        self.db.refresh(transaksi)
        self._emit_change(transaksi, "status_updated")
        return transaksi

    def void_transaction(self, transaksi_id: int) -> bool:
        """Void a transaction and restore stock.

        Note: Should only be used for recent transactions.
        """
        try:
            transaksi = self.get_by_id(transaksi_id)

            # 0. Check if already cancelled to prevent double stock restoration
            if transaksi.status_bayar == PaymentStatus.BATAL:
                return True

            # 1. Restore spare part stock
            for detail in transaksi.detail_parts:
                spare_part = (
                    self.db.query(SparePart)
                    .filter(SparePart.id == detail.spare_part_id)
                    .first()
                )
                if spare_part and not is_always_ready_stock(spare_part.stok):
                    spare_part.stok += detail.qty

            # 2. Void related Piutang (external + internal unit transfers)
            piutang_rows = (
                self.db.query(PiutangUsaha)
                .filter(
                    PiutangUsaha.nomor_referensi == transaksi.nomor_transaksi,
                    PiutangUsaha.sumber.in_([
                        PiutangSource.BENGKEL,
                        PiutangSource.JASA_ANGKUT,
                        PiutangSource.JUAL_BELI_MOBIL,
                    ]),
                )
                .all()
            )

            # 3. Delete related KasBank entries (Financial Balance)
            self.db.query(KasBank).filter(
                KasBank.nomor_referensi == transaksi.nomor_transaksi,
                KasBank.sumber.in_([
                    KasBankSource.BENGKEL,
                    KasBankSource.JASA_ANGKUT,
                    KasBankSource.JUAL_BELI_MOBIL,
                ]),
            ).delete(synchronize_session=False)
            self.db.query(KasBank).filter(
                KasBank.referensi_id == transaksi.id,
                KasBank.sumber == KasBankSource.BENGKEL,
            ).delete(synchronize_session=False)

            for piutang in piutang_rows:
                pembayaran_ids = [p.id for p in piutang.pembayaran]
                if pembayaran_ids:
                    self.db.query(KasBank).filter(
                        KasBank.referensi_id.in_(pembayaran_ids),
                        or_(KasBank.sumber == KasBankSource.PIUTANG, KasBank.sumber == KasBankSource.BENGKEL)
                    ).delete(synchronize_session=False)

                piutang.status = PiutangStatus.BATAL
                piutang.sisa_piutang = Decimal("0")

            # 4. Void related Hutang (Internal)
            hutang_rows = (
                self.db.query(HutangUsaha)
                .filter(
                    HutangUsaha.nomor_referensi == transaksi.nomor_transaksi,
                    HutangUsaha.is_internal == True,
                )
                .all()
            )
            for hutang in hutang_rows:
                hutang.status = HutangStatus.BATAL
                hutang.sisa_hutang = Decimal("0")

            # 5. Remove linked costs (Mobil & Jasa Angkut)
            self.db.query(MobilPartService).filter(
                MobilPartService.catatan.like(f"%{transaksi.nomor_transaksi}%")
            ).delete(synchronize_session=False)

            self.db.query(JasaAngkutPartService).filter(
                JasaAngkutPartService.catatan.like(f"%{transaksi.nomor_transaksi}%")
            ).delete(synchronize_session=False)

            # 6. VOID Transaction instead of deleting
            transaksi.status_pengerjaan = WorkshopStatus.BATAL
            transaksi.status_bayar = PaymentStatus.BATAL

            self.db.commit()

            from app.services.kas_bank_service import KasBankService
            KasBankService(self.db).rebuild_balances()

            self._emit_change(transaksi, "voided")

            return True
        except Exception:
            self.db.rollback()
            raise


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
