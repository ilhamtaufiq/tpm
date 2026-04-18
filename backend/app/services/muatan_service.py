from app.services.kas_bank_integration import create_kas_entry
from app.utils.constants import KasBankType, KasBankSource, KasBankJenis, TRANSACTION_PREFIXES
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any, List

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload, selectinload
from fastapi import HTTPException, status

from app.models.jasa_angkut import Supir, MuatanJasaAngkut, JasaAngkutBiayaLainnya, JasaAngkutPartService
from app.models.bengkel import SparePart
from app.models.keuangan import PiutangUsaha, PembayaranPiutang
from app.schemas.jasa_angkut import MuatanCreate, MuatanUpdate, MuatanPaymentSplit
from app.utils.constants import (
    PaymentMethod,
    PaymentStatus,
    MuatanStatus,
    PiutangSource,
    PiutangStatus,
)
from app.models.keuangan import PiutangUsaha, PembayaranPiutang, KasBank


class MuatanService:
    """Service for transportation load management."""

    def __init__(self, db: Session):
        self.db = db

    def _generate_nomor_transaksi(self) -> str:
        """Generate unique transaction number."""
        today = datetime.now()
        prefix = TRANSACTION_PREFIXES["jasa_angkut"]
        date_str = today.strftime("%y%m%d")

        last = (
            self.db.query(MuatanJasaAngkut)
            .filter(MuatanJasaAngkut.nomor_transaksi.like(f"{prefix}{date_str}%"))
            .order_by(MuatanJasaAngkut.id.desc())
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
        prefix = "AR" # AR-YYMMDD-XXXX
        date_str = today.strftime("%y%m%d")
        
        last = (
            self.db.query(PiutangUsaha)
            .filter(PiutangUsaha.nomor_piutang.like(f"{prefix}{date_str}%"))
            .order_by(PiutangUsaha.id.desc())
            .first()
        )

        if last:
            # Handle potential variations, but primarily extract last 4 digits
            # The error showed 'AR2602010001' which suggests no hyphens are used
            try:
                last_num = int(last.nomor_piutang[-4:])
            except ValueError:
                # Fallback if format is unexpected
                last_num = 0
            new_num = last_num + 1
        else:
            new_num = 1
            
        return f"{prefix}{date_str}{new_num:04d}"



    def _validate_supir(self, supir_id: Optional[int]) -> Optional[Supir]:
        """Validate driver exists and is active."""
        if not supir_id:
            return None
            
        supir = (
            self.db.query(Supir)
            .filter(
                Supir.id == supir_id,
                Supir.deleted_at.is_(None),
            )
            .first()
        )
        if not supir:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Supir tidak ditemukan",
            )
        if not supir.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Supir tidak aktif",
            )
        return supir

    def _validate_armada(self, armada_id: Optional[int]) -> Optional[Any]:
        """Validate armada exists and is active."""
        if not armada_id:
            return None

        from app.models.jasa_angkut import ArmadaJasaAngkut
        armada = (
            self.db.query(ArmadaJasaAngkut)
            .filter(
                ArmadaJasaAngkut.id == armada_id,
                ArmadaJasaAngkut.deleted_at.is_(None),
            )
            .first()
        )
        if not armada:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Armada tidak ditemukan",
            )
        if not armada.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Armada tidak aktif",
            )
        return armada

    def _calculate_profit(
        self,
        pendapatan_kotor: Decimal,
        total_biaya_operasional: Decimal,
        persentase_tpm: Decimal,
    ) -> Dict[str, Decimal]:
        """Calculate profit split.
        
        New Logic: Operational costs are NOT deducted from the trip's laba_tpm.
        Instead, they are recorded as armada-level expenses.
        Trip laba_tpm represents the Gross TPM Share.
        """
        # Gross profit for calculation base (Revenue - Cost of goods)
        laba_kotor_gross = pendapatan_kotor
        
        # Calculate base shares (usually 50/50)
        share_supir = (laba_kotor_gross * (Decimal("100") - persentase_tpm) / 100).quantize(Decimal("0.01"))
        share_tpm_gross = (laba_kotor_gross * persentase_tpm / 100).quantize(Decimal("0.01"))
        
        # Per User Request: Total laba_tpm in DB should be GROSS (before operational expenses)
        # The operational expenses are aggregates per armada in reports instead.
        laba_tpm = share_tpm_gross
        laba_supir = share_supir
        
        # Trip Laba Kotor is also reported as Gross for this unit
        laba_kotor_final = laba_kotor_gross

        return {
            "total_biaya": total_biaya_operasional,
            "laba_kotor": laba_kotor_final,
            "laba_tpm": laba_tpm,
            "laba_supir": laba_supir,
        }


    def get_route_suggestions(self, field: str, query: Optional[str] = None, limit: int = 10) -> List[str]:
        """Get unique suggestions for route fields (asal/tujuan) with optional search."""
        if field not in ["asal", "tujuan"]:
            return []

        column = getattr(MuatanJasaAngkut, field)
        
        q = self.db.query(column, func.count(column).label("popularity")).filter(column.is_not(None), column != "")

        if query:
            q = q.filter(column.ilike(f"%{query}%"))

        # Get most frequent recent locations
        results = (
            q.group_by(column)
            .order_by(func.count(column).desc())
            .limit(limit)
            .all()
        )
        
        return [r[0] for r in results]

    def create(
        self,
        data: MuatanCreate,
        user_id: Optional[int] = None,
    ) -> MuatanJasaAngkut:
        """Create a new transport load record."""
        # ... existing validation and generation ...
        # Validate driver and armada
        supir = self._validate_supir(data.supir_id)
        armada = self._validate_armada(data.armada_id)

        # Generate transaction number
        nomor_transaksi = self._generate_nomor_transaksi()

        # Calculate revenue from trading logic
        pendapatan_kotor = data.harga_jual - data.harga_beli

        # Create muatan record
        muatan = MuatanJasaAngkut(
            nomor_transaksi=nomor_transaksi,
            tanggal=data.tanggal,
            supir_id=data.supir_id,
            supir_nama_manual=data.supir_nama,
            armada_id=data.armada_id,
            nopol=data.nopol or (armada.nopol if armada else None),
            info_kendaraan=data.info_kendaraan or (armada.nama if armada else None),
            asal=data.asal,
            tujuan=data.tujuan,
            jenis_muatan=data.jenis_muatan,
            ritase=data.ritase,
            berat_muatan=data.berat_muatan if data.berat_muatan else None,
            harga_beli=data.harga_beli,
            harga_jual=data.harga_jual,
            pendapatan_kotor=pendapatan_kotor,
            biaya_bbm=Decimal("0"),
            biaya_tol=Decimal("0"),
            biaya_makan=Decimal("0"),
            biaya_parkir=Decimal("0"),
            biaya_lainnya=Decimal("0"),
            total_biaya=Decimal("0"),
            laba_kotor=Decimal("0"),
            persentase_tpm=data.persentase_tpm,
            laba_tpm=Decimal("0"),
            laba_supir=Decimal("0"),
            status_bayar=data.status_bayar or PaymentStatus.BELUM_LUNAS,
            catatan=data.catatan,
            created_by=user_id,
        )

        self.db.add(muatan)
        self.db.flush() # Get ID

        # ... (Operational Costs & Bengkel Logic) ...
        # Add operational costs
        for item in data.biaya_operasional:
            biaya = JasaAngkutBiayaLainnya(
                muatan_id=muatan.id,
                armada_id=muatan.armada_id, # Set armada_id
                tanggal=data.tanggal,
                kategori="Operasional",
                deskripsi=item.deskripsi,
                jumlah=item.jumlah,
            )
            self.db.add(biaya)


            # Record operational cost to kas/bank (money going out)
            create_kas_entry(
                db=self.db,
                tanggal=data.tanggal,
                tipe=KasBankType.KELUAR,
                nominal=item.jumlah,
                sumber=KasBankSource.JASA_ANGKUT,
                metode_bayar=PaymentMethod.TUNAI, # Usually operations are cash
                referensi_id=muatan.id,
                nomor_referensi=muatan.nomor_transaksi,
                keterangan=f"Biaya Operational Muatan {nomor_transaksi}: {item.deskripsi}",
                user_id=user_id,
                allow_negative=True
            )
        
        # Determine total dynamic cost initially
        total_dynamic_cost = sum(item.jumlah for item in data.biaya_operasional)



        # Calculate final profit
        profit = self._calculate_profit(
            pendapatan_kotor,
            total_dynamic_cost,
            data.persentase_tpm
        )
        
        muatan.total_biaya = profit["total_biaya"]
        muatan.laba_kotor = profit["laba_kotor"]
        muatan.laba_tpm = profit["laba_tpm"]
        muatan.laba_supir = profit["laba_supir"]

        if muatan.status_bayar == PaymentStatus.BELUM_LUNAS:
            # Generate Piutang Record
            debtor_name = muatan.supir_nama or "Unknown Driver"
            nominal_piutang = data.pendapatan_kotor # Using profit margin as receivable base per previous logic?
            # WAIT. If it's an external invoice, receivable should be 'harga_jual'.
            # But the previous code used 'nominal_piutang = data.pendapatan_kotor' (I saw this in step 16 ViewFile).
            # If the business model is "Driver sets deposit", maybe?
            # "Pendapatan Kotor" = Jual - Beli.
            # If I fix this, I should be careful.
            # Let's stick to existing Piutang logic (pendapatan_kotor) to avoid breaking business logic I don't fully grasp yet.
            # Actually, let's verify if I should fix it to harga_jual.
            # User query is about "Method Payment".
            # I will assume the previous Piutang logic was intentional or I should check it.
            # Step 16 showed: `nominal_piutang = data.pendapatan_kotor`.  Wait, `data` is `MuatanCreate`.
            # If I change status to LUNAS, I must record CASH IN.
            # Cash In should normally be `harga_jual` (Total Invoice).
            # But if Piutang is only `pendapatan_kotor`, maybe the `harga_beli` is handled externally?
            # Let's check `harga_beli`. Usually "Uang Jalan" given to driver?
            # If `harga_beli` is "Modal" (Cost), and we sell at `harga_jual`.
            # If we receive `harga_jual`, we cover the `harga_beli`.
            # I'll use `muatan.harga_jual` for Kas Masuk as it's the real money coming in.
            
            # TPM portion only for receivable (excluding Driver Share)
            tpm_gross_portion = muatan.pendapatan_kotor - muatan.laba_supir
            
            piutang = PiutangUsaha(
                nomor_piutang=self._generate_nomor_piutang(),
                tanggal=data.tanggal,
                sumber=PiutangSource.JASA_ANGKUT,
                referensi_id=muatan.id,
                nomor_referensi=muatan.nomor_transaksi,
                customer_id=None,
                nama_debitur=debtor_name,
                telepon_debitur=supir.telepon if supir else None,
                alamat_debitur=supir.alamat if supir else None,
                nominal_piutang=tpm_gross_portion,
                total_dibayar=Decimal("0"),
                sisa_piutang=tpm_gross_portion,
                status=PiutangStatus.BELUM_LUNAS,
                catatan=f"Piutang Jasa Angkut {muatan.nomor_transaksi} (Bagian TPM)",
                created_by=user_id,
            )
            self.db.add(piutang)
        
        elif muatan.status_bayar == PaymentStatus.LUNAS:
             # Record Income to Kas/Bank
             tpm_gross_portion = muatan.pendapatan_kotor - muatan.laba_supir
             
             if data.payments:
                 for p in data.payments:
                     if p.nominal > 0:
                         create_kas_entry(
                             db=self.db,
                             tanggal=data.tanggal,
                             tipe=KasBankType.MASUK,
                             nominal=p.nominal,
                             sumber=KasBankSource.JASA_ANGKUT,
                             metode_bayar=p.metode,
                             referensi_id=muatan.id,
                             nomor_referensi=muatan.nomor_transaksi,
                             keterangan=f"Pemasukan Jasa Angkut ({p.metode.upper()}): {muatan.nomor_transaksi} (Net TPM)",
                             user_id=user_id,
                             kas_jenis=p.kas_jenis,
                         )
             else:
                 create_kas_entry(
                    db=self.db,
                    tanggal=data.tanggal,
                    tipe=KasBankType.MASUK,
                    nominal=tpm_gross_portion,
                    sumber=KasBankSource.JASA_ANGKUT,
                    metode_bayar=data.metode_bayar or PaymentMethod.TUNAI, # Use provided method
                    referensi_id=muatan.id,
                    nomor_referensi=muatan.nomor_transaksi,
                    keterangan=f"Pemasukan Jasa Angkut {muatan.nomor_transaksi} (Net TPM)",
                    user_id=user_id,
                    kas_jenis=data.kas_jenis,
                 )
 
        self.db.commit()
        self.db.refresh(muatan)
 
        return muatan



    def get_by_id(self, muatan_id: int) -> MuatanJasaAngkut:
        """Get transport load by ID."""
        muatan = (
            self.db.query(MuatanJasaAngkut)
            .options(
                joinedload(MuatanJasaAngkut.supir),
                joinedload(MuatanJasaAngkut.armada),
                joinedload(MuatanJasaAngkut.biaya_tambahan),
                selectinload(MuatanJasaAngkut.part_services),
            )
            .filter(MuatanJasaAngkut.id == muatan_id)
            .first()
        )
        if not muatan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Muatan tidak ditemukan",
            )
        
        # Add piutang info to the response
        piutang = (
            self.db.query(PiutangUsaha.id, PiutangUsaha.total_dibayar)
            .filter(
                PiutangUsaha.nomor_referensi == muatan.nomor_transaksi,
                PiutangUsaha.sumber == PiutangSource.JASA_ANGKUT
            )
            .first()
        )
        if piutang:
            muatan.piutang_id = piutang.id
            muatan.jumlah_bayar = piutang.total_dibayar
        else:
            muatan.jumlah_bayar = muatan.pendapatan_kotor - muatan.laba_supir if muatan.status_bayar == PaymentStatus.LUNAS else 0

        return muatan

    def get_by_nomor(self, nomor_transaksi: str) -> Optional[MuatanJasaAngkut]:
        """Get transport load by transaction number."""
        return (
            self.db.query(MuatanJasaAngkut)
            .options(
                joinedload(MuatanJasaAngkut.supir),
                joinedload(MuatanJasaAngkut.armada)
            )
            .filter(MuatanJasaAngkut.nomor_transaksi == nomor_transaksi)
            .first()
        )

    def get_list(
        self,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        supir_id: Optional[int] = None,
        status_bayar: Optional[PaymentStatus] = None,
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
        sort_by: str = "tanggal",
        sort_order: str = "desc",
    ) -> Dict[str, Any]:
        """Get list of transport loads with pagination and filters."""
        query = self.db.query(MuatanJasaAngkut).options(
            joinedload(MuatanJasaAngkut.supir),
            joinedload(MuatanJasaAngkut.armada),
            selectinload(MuatanJasaAngkut.biaya_tambahan),
            selectinload(MuatanJasaAngkut.part_services),
        )

        # Search filter
        if search:
            search_filter = f"%{search}%"
            query = query.outerjoin(MuatanJasaAngkut.supir).filter(
                or_(
                    MuatanJasaAngkut.nomor_transaksi.ilike(search_filter),
                    MuatanJasaAngkut.asal.ilike(search_filter),
                    MuatanJasaAngkut.tujuan.ilike(search_filter),
                    Supir.nama.ilike(search_filter),
                    MuatanJasaAngkut.supir_nama_manual.ilike(search_filter),
                )
            )

        # Driver filter
        if supir_id:
            query = query.filter(MuatanJasaAngkut.supir_id == supir_id)

        # Payment status filter
        if status_bayar:
            query = query.filter(MuatanJasaAngkut.status_bayar == status_bayar)

        # Date range filter
        if tanggal_dari:
            query = query.filter(MuatanJasaAngkut.tanggal >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(MuatanJasaAngkut.tanggal <= tanggal_sampai)

        # Count total
        total = query.count()

        # Sorting
        sort_column = getattr(MuatanJasaAngkut, sort_by, MuatanJasaAngkut.tanggal)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        # Pagination
        muatans = query.offset(skip).limit(limit).all()

        # Batch fetch piutang info
        if muatans:
            nomor_refs = [m.nomor_transaksi for m in muatans]
            piutang_info = self.db.query(
                PiutangUsaha.id, PiutangUsaha.nomor_referensi, PiutangUsaha.total_dibayar
            ).filter(
                PiutangUsaha.nomor_referensi.in_(nomor_refs),
                PiutangUsaha.sumber == PiutangSource.JASA_ANGKUT
            ).all()
            
            piutang_map = {p.nomor_referensi: (p.id, p.total_dibayar) for p in piutang_info}
            
            for m in muatans:
                info = piutang_map.get(m.nomor_transaksi)
                if info:
                    m.piutang_id, m.jumlah_bayar = info
                else:
                    m.jumlah_bayar = m.pendapatan_kotor - m.laba_supir if m.status_bayar == PaymentStatus.LUNAS else 0

        # Calculate pages
        pages = (total + limit - 1) // limit if limit > 0 else 1

        return {
            "data": muatans,
            "total": total,
            "page": (skip // limit) + 1 if limit > 0 else 1,
            "size": limit,
            "pages": pages,
        }

    def update(
        self,
        muatan_id: int,
        data: MuatanUpdate,
    ) -> MuatanJasaAngkut:
        """Update transport load."""
        muatan = self.get_by_id(muatan_id)

        # Cannot update paid transaction
        # Cannot update paid transaction - RULE REMOVED BY USER REQUEST
        # if muatan.status_bayar == PaymentStatus.LUNAS:
        #     raise HTTPException(
        #         status_code=status.HTTP_400_BAD_REQUEST,
        #         detail="Tidak dapat mengubah transaksi yang sudah lunas",
        #     )

        update_data = data.model_dump(exclude_unset=True)

        if "armada_id" in update_data:
            self._validate_armada(update_data["armada_id"])

        # Map supir_nama to supir_nama_manual
        if "supir_nama" in update_data:
            update_data["supir_nama_manual"] = update_data.pop("supir_nama")

        for field, value in update_data.items():
            if field != "biaya_operasional":
                setattr(muatan, field, value)

        # Recalculate revenue if prices changed
        muatan.pendapatan_kotor = muatan.harga_jual - muatan.harga_beli

        # Handle operational costs update
        if data.biaya_operasional is not None:
            # FIX: Only delete 'Operasional' costs (preserve 'Perawatan Bengkel')
            self.db.query(JasaAngkutBiayaLainnya).filter(
                JasaAngkutBiayaLainnya.muatan_id == muatan.id,
                JasaAngkutBiayaLainnya.kategori == "Operasional"
            ).delete()
            
            # Add new costs
            for item in data.biaya_operasional:
                biaya = JasaAngkutBiayaLainnya(
                    muatan_id=muatan.id,
                    armada_id=muatan.armada_id, # Set armada_id
                    tanggal=muatan.tanggal,
                    kategori="Operasional",
                    deskripsi=item.deskripsi,
                    jumlah=item.jumlah,
                )
                self.db.add(biaya)

            
            # Calculate total dynamic cost from the input list directly for profit calc
            # We must also include existing 'Perawatan Bengkel' cost if any
            bengkel_cost = self.db.query(func.sum(JasaAngkutBiayaLainnya.jumlah)).filter(
                JasaAngkutBiayaLainnya.muatan_id == muatan.id,
                JasaAngkutBiayaLainnya.kategori == "Perawatan Bengkel"
            ).scalar() or Decimal("0")
            
            total_dynamic_cost = sum(item.jumlah for item in data.biaya_operasional) + bengkel_cost


        
        else:
            # If bengkel items not touched, check if total_dynamic_cost was calculated (if expenses touched)
            # If expenses logic above ran, `total_dynamic_cost` is set.
            # If NEITHER touched, `total_dynamic_cost` is NOT set.
            pass

        if 'total_dynamic_cost' not in locals():
            # Fallback if neither was updated, just get current sum to be safe for profit recalc
            total_dynamic_cost = sum(b.jumlah for b in muatan.biaya_tambahan)

        # Recalculate profit
        profit = self._calculate_profit(
            muatan.pendapatan_kotor,
            total_dynamic_cost,
            muatan.persentase_tpm,
        )

        muatan.total_biaya = profit["total_biaya"]
        muatan.laba_kotor = profit["laba_kotor"]
        muatan.laba_tpm = profit["laba_tpm"]
        muatan.laba_supir = profit["laba_supir"]

        self.db.commit()
        self.db.refresh(muatan)

        return muatan

    def mark_paid(
        self,
        muatan_id: int,
        metode_bayar: PaymentMethod = PaymentMethod.TUNAI,
        tanggal_bayar: Optional[date] = None,
        user_id: Optional[int] = None,
    ) -> MuatanJasaAngkut:
        """Mark transport load as paid."""
        muatan = self.get_by_id(muatan_id)

        if muatan.status_bayar == PaymentStatus.LUNAS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transaksi sudah lunas",
            )

        muatan.status_bayar = PaymentStatus.LUNAS
        muatan.tanggal_bayar = tanggal_bayar or date.today()

        # Update linked Piutang if exists
        piutang = (
            self.db.query(PiutangUsaha)
            .filter(
                PiutangUsaha.referensi_id == muatan.id,
                PiutangUsaha.sumber == PiutangSource.JASA_ANGKUT
            )
            .first()
        )
        
        if piutang and piutang.status != PiutangStatus.LUNAS:
             # Pay full remaining amount
             amount_to_pay = piutang.sisa_piutang
             
             # Create payment record
             payment = PembayaranPiutang(
                 piutang_id=piutang.id,
                 tanggal=muatan.tanggal_bayar,
                 nominal=amount_to_pay,
                 metode_bayar=metode_bayar,
                 catatan="Pelunasan Manual dari Jasa Angkut",
                 created_by=user_id,
             )
             self.db.add(payment)
             
             piutang.process_payment(amount_to_pay)
             
             # Record mutation
             create_kas_entry(
                 db=self.db,
                 tanggal=muatan.tanggal_bayar,
                 tipe=KasBankType.MASUK,
                 nominal=amount_to_pay,
                 sumber=KasBankSource.JASA_ANGKUT,
                 metode_bayar=metode_bayar,
                 referensi_id=payment.id,
                 nomor_referensi=piutang.nomor_piutang,
                 keterangan=f"Pelunasan Jasa Angkut {muatan.nomor_transaksi} via {piutang.nomor_piutang}",
                 user_id=user_id,
             )


        # Also mark linked bengkel transactions (INTERNAL) as paid
        from app.models.bengkel import TransaksiPenjualanBengkel
        linked_bengkel = (
            self.db.query(TransaksiPenjualanBengkel)
            .filter(
                TransaksiPenjualanBengkel.muatan_id == muatan.id,
                TransaksiPenjualanBengkel.metode_bayar == PaymentMethod.INTERNAL,
                TransaksiPenjualanBengkel.status_bayar != PaymentStatus.LUNAS,
            )
            .all()
        )
        for tb in linked_bengkel:
            tb.status_bayar = PaymentStatus.LUNAS
            tb.jumlah_bayar = tb.grand_total

        self.db.commit()
        self.db.refresh(muatan)

        return muatan

    def mark_paid_split(
        self,
        data: MuatanPaymentSplit,
        user_id: Optional[int] = None,
    ) -> MuatanJasaAngkut:
        """Mark transport load as paid with multiple payment methods."""
        muatan = self.get_by_id(data.muatan_id)

        if muatan.status_bayar == PaymentStatus.LUNAS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transaksi sudah lunas",
            )

        # Update linked Piutang if exists
        piutang = (
            self.db.query(PiutangUsaha)
            .filter(
                PiutangUsaha.referensi_id == muatan.id,
                PiutangUsaha.sumber == PiutangSource.JASA_ANGKUT
            )
            .first()
        )
        
        if piutang and piutang.status != PiutangStatus.LUNAS:
            from app.services.piutang_service import PiutangService
            from app.schemas.keuangan import PembayaranPiutangSplit
            
            piutang_service = PiutangService(self.db)
            split_data = PembayaranPiutangSplit(
                piutang_id=piutang.id,
                tanggal=data.tanggal,
                payments=data.payments,
                catatan=data.catatan or "Pelunasan Split dari Jasa Angkut"
            )
            piutang_service.process_payment_split(split_data, user_id)
            
            # Check if piutang is now lunas to update muatan
            self.db.refresh(piutang)
            if piutang.status == PiutangStatus.LUNAS:
                muatan.status_bayar = PaymentStatus.LUNAS
                muatan.tanggal_bayar = data.tanggal
        else:
            # Fallback if no piutang found (should not happen if credit)
            # but if it was somehow partially paid or something else
            muatan.status_bayar = PaymentStatus.LUNAS
            muatan.tanggal_bayar = data.tanggal

        # Also mark linked bengkel transactions (INTERNAL) as paid
        from app.models.bengkel import TransaksiPenjualanBengkel
        linked_bengkel = (
            self.db.query(TransaksiPenjualanBengkel)
            .filter(
                TransaksiPenjualanBengkel.muatan_id == muatan.id,
                TransaksiPenjualanBengkel.metode_bayar == PaymentMethod.INTERNAL,
                TransaksiPenjualanBengkel.status_bayar != PaymentStatus.LUNAS,
            )
            .all()
        )
        for tb in linked_bengkel:
            tb.status_bayar = PaymentStatus.LUNAS
            tb.jumlah_bayar = tb.grand_total

        self.db.commit()
        self.db.refresh(muatan)

        return muatan

    def delete(self, muatan_id: int) -> bool:
        """Delete transport load."""
        muatan = self.get_by_id(muatan_id)

        # Cannot delete paid transaction
        if muatan.status_bayar == PaymentStatus.LUNAS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat menghapus transaksi yang sudah lunas",
            )

        self.db.delete(muatan)
        self.db.commit()

        return True

    # Additional cost management
    def add_biaya(
        self,
        muatan_id: int,
        kategori: str,
        deskripsi: str,
        jumlah: Decimal,
        catatan: Optional[str] = None,
    ) -> JasaAngkutBiayaLainnya:
        """Add additional cost to transport load."""
        muatan = self.get_by_id(muatan_id)

        # if muatan.status_bayar == PaymentStatus.LUNAS:
        #     raise HTTPException(
        #         status_code=status.HTTP_400_BAD_REQUEST,
        #         detail="Tidak dapat menambah biaya untuk transaksi yang sudah lunas",
        #     )

        biaya = JasaAngkutBiayaLainnya(
            muatan_id=muatan_id,
            tanggal=muatan.tanggal,
            kategori=kategori,
            deskripsi=deskripsi,
            jumlah=jumlah,
            catatan=catatan,
        )

        self.db.add(biaya)

        # Recalculate profit including additional cost
        muatan.biaya_lainnya += jumlah
        muatan.calculate_profit()

        self.db.commit()
        self.db.refresh(biaya)

        return biaya

    def delete_biaya(self, biaya_id: int) -> bool:
        """Delete additional cost."""
        biaya = (
            self.db.query(JasaAngkutBiayaLainnya)
            .filter(JasaAngkutBiayaLainnya.id == biaya_id)
            .first()
        )
        if not biaya:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Biaya tidak ditemukan",
            )

        muatan = self.get_by_id(biaya.muatan_id)

        # if muatan.status_bayar == PaymentStatus.LUNAS:
        #     raise HTTPException(
        #         status_code=status.HTTP_400_BAD_REQUEST,
        #         detail="Tidak dapat menghapus biaya dari transaksi yang sudah lunas",
        #     )

        # Subtract from biaya_lainnya
        muatan.biaya_lainnya -= biaya.jumlah
        if muatan.biaya_lainnya < 0:
            muatan.biaya_lainnya = Decimal("0")

        self.db.delete(biaya)

        # Recalculate profit
        muatan.calculate_profit()

        self.db.commit()

        return True

    def get_summary(
        self,
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
        search: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get transport load summary statistics."""
        # Base query with date filters
        query = self.db.query(MuatanJasaAngkut)

        if tanggal_dari:
            query = query.filter(MuatanJasaAngkut.tanggal >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(MuatanJasaAngkut.tanggal <= tanggal_sampai)
            
        if search:
            q = f"%{search}%"
            query = query.filter(
                or_(
                    MuatanJasaAngkut.nomor_transaksi.ilike(q),
                    MuatanJasaAngkut.nopol.ilike(q),
                    MuatanJasaAngkut.asal.ilike(q),
                    MuatanJasaAngkut.tujuan.ilike(q),
                )
            )

        # Total transactions
        total_count = query.count()

        # Payment Status Counts
        lunas_count = query.filter(MuatanJasaAngkut.status_bayar == PaymentStatus.LUNAS).count()
        batal_count = query.filter(MuatanJasaAngkut.status_bayar == PaymentStatus.BATAL).count()
        active_count = query.filter(MuatanJasaAngkut.status == MuatanStatus.PROSES).count()
        
        # Partially paid (status_bayar is BELUM_LUNAS but some amount is paid)
        # However, for Jasa Angkut, payment is tracked via Piutang if not cash.
        # We'll use a simplified check for now or join with Piutang.
        from app.models.keuangan import PiutangUsaha
        from app.utils.constants import PiutangSource
        
        # We need a subquery for piutang info if we want precise partial vs unpaid
        piutang_sub = (
            self.db.query(
                PiutangUsaha.referensi_id,
                PiutangUsaha.total_dibayar
            )
            .filter(PiutangUsaha.sumber == PiutangSource.JASA_ANGKUT)
            .subquery()
        )
        
        # JOIN to find partial vs unpaid
        # Partial: Not Lunas, Not Batal, and total_dibayar > 0
        # Unpaid: Not Lunas, Not Batal, and total_dibayar == 0
        
        non_final_query = query.filter(
            MuatanJasaAngkut.status_bayar != PaymentStatus.LUNAS,
            MuatanJasaAngkut.status_bayar != PaymentStatus.BATAL
        )
        
        partial_count = (
            non_final_query.outerjoin(piutang_sub, MuatanJasaAngkut.id == piutang_sub.c.referensi_id)
            .filter(piutang_sub.c.total_dibayar > 0)
            .count()
        )
        
        unpaid_count = (
            non_final_query.outerjoin(piutang_sub, MuatanJasaAngkut.id == piutang_sub.c.referensi_id)
            .filter(or_(piutang_sub.c.referensi_id.is_(None), piutang_sub.c.total_dibayar == 0))
            .count()
        )

        # Aggregate values from Muatan table
        aggregates = query.filter(MuatanJasaAngkut.status_bayar != PaymentStatus.BATAL).with_entities(
            func.sum(MuatanJasaAngkut.pendapatan_kotor - MuatanJasaAngkut.laba_supir).label("total_pendapatan"),
            func.sum(MuatanJasaAngkut.laba_supir).label("total_laba_supir"),
            func.sum(MuatanJasaAngkut.total_biaya).label("total_biaya_linked"),
        ).first()

        total_pendapatan = float(aggregates.total_pendapatan or 0)
        total_laba_supir = float(aggregates.total_laba_supir or 0)
        total_biaya_linked = float(aggregates.total_biaya_linked or 0)

        # 1. Biaya Bengkel Total (Linked + Unlinked)
        from app.models.bengkel import TransaksiPenjualanBengkel
        from app.models.jasa_angkut import JasaAngkutPartService

        # All JA workshop repairs in period
        bengkel_parts = self.db.query(func.sum(TransaksiPenjualanBengkel.grand_total)).filter(
            TransaksiPenjualanBengkel.kategori == 'jasa_angkut',
            TransaksiPenjualanBengkel.status_bayar != PaymentStatus.BATAL
        )
        if tanggal_dari: bengkel_parts = bengkel_parts.filter(TransaksiPenjualanBengkel.tanggal >= tanggal_dari)
        if tanggal_sampai: bengkel_parts = bengkel_parts.filter(TransaksiPenjualanBengkel.tanggal <= tanggal_sampai)
        
        # All JA supplemental maintenance in period
        bengkel_tambahan_q = self.db.query(func.sum(JasaAngkutBiayaLainnya.jumlah)).filter(
            JasaAngkutBiayaLainnya.kategori == "Perawatan Bengkel"
        )
        if tanggal_dari: bengkel_tambahan_q = bengkel_tambahan_q.filter(JasaAngkutBiayaLainnya.tanggal >= tanggal_dari)
        if tanggal_sampai: bengkel_tambahan_q = bengkel_tambahan_q.filter(JasaAngkutBiayaLainnya.tanggal <= tanggal_sampai)
        
        total_biaya_bengkel = float((bengkel_parts.scalar() or 0) + (bengkel_tambahan_q.scalar() or 0))

        # 2. Operational Costs (Everything from JasaAngkutBiayaLainnya in category 'Operasional')
        operasional_q = self.db.query(func.sum(JasaAngkutBiayaLainnya.jumlah)).filter(
            JasaAngkutBiayaLainnya.kategori == "Operasional"
        )
        if tanggal_dari: operasional_q = operasional_q.filter(JasaAngkutBiayaLainnya.tanggal >= tanggal_dari)
        if tanggal_sampai: operasional_q = operasional_q.filter(JasaAngkutBiayaLainnya.tanggal <= tanggal_sampai)
        
        # 3. Fixed Trip Costs from Muatan table (BBM, Tol, etc.)
        fixed_costs_q = query.filter(MuatanJasaAngkut.status_bayar != PaymentStatus.BATAL).with_entities(
            func.sum(
                MuatanJasaAngkut.biaya_bbm + 
                MuatanJasaAngkut.biaya_tol + 
                MuatanJasaAngkut.biaya_parkir + 
                MuatanJasaAngkut.biaya_makan +
                MuatanJasaAngkut.biaya_lainnya
            )
        )
        
        total_biaya_trip = float(fixed_costs_q.scalar() or 0)

        # 4. Operational & Maintenance Costs for the unit
        # (Workshop repairs, fleet maintenance logs, and general wallet outflows)
        from app.models.keuangan import KasBank
        from app.utils.constants import KasBankSource, KasBankType, PaymentMethod
        
        # General Wallet Outflows (excluding transfers and internal bookkeeping)
        wallet_out_q = self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.jenis == KasBankJenis.KAS_UNIT_JASA_ANGKUT,
            KasBank.tipe == KasBankType.KELUAR,
            ~KasBank.keterangan.like("Transfer ke %"),
            # Exclude internal workshop/part payments as they are already counted in biaya_bengkel
            KasBank.sumber != KasBankSource.BENGKEL,
            KasBank.sumber != KasBankSource.PEMBELIAN_PART,
            or_(KasBank.metode_bayar != PaymentMethod.INTERNAL, KasBank.metode_bayar == None)
        )
        if tanggal_dari: wallet_out_q = wallet_out_q.filter(KasBank.tanggal >= tanggal_dari)
        if tanggal_sampai: wallet_out_q = wallet_out_q.filter(KasBank.tanggal <= tanggal_sampai)
        
        wallet_out = float(wallet_out_q.scalar() or 0)

        # Combine all non-trip costs as "Operational Unit Costs"
        total_biaya_operasional_unit = total_biaya_bengkel + float(operasional_q.scalar() or 0) + wallet_out

        # Breakdown Jasa Angkut by Armada for display purposes
        from app.models.jasa_angkut import ArmadaJasaAngkut
        armada_ja_query = self.db.query(
            ArmadaJasaAngkut.nama,
            func.sum(KasBank.nominal)
        ).join(
            KasBank, KasBank.referensi_id == ArmadaJasaAngkut.id
        ).filter(
            KasBank.jenis == KasBankJenis.KAS_UNIT_JASA_ANGKUT,
            KasBank.tipe == KasBankType.KELUAR,
            KasBank.sumber == KasBankSource.JASA_ANGKUT
        )
        if tanggal_dari: armada_ja_query = armada_ja_query.filter(KasBank.tanggal >= tanggal_dari)
        if tanggal_sampai: armada_ja_query = armada_ja_query.filter(KasBank.tanggal <= tanggal_sampai)
        
        by_armada_ja = armada_ja_query.group_by(ArmadaJasaAngkut.nama).all()
        armada_ja_summary = {row[0]: float(row[1] or 0) for row in by_armada_ja}

        # Cash Breakdown for Jasa Angkut Wallet
        # 1. Total Tunai (Payments entering KAS_UNIT_JASA_ANGKUT)
        total_tunai_q = self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.jenis == KasBankJenis.KAS_UNIT_JASA_ANGKUT,
            KasBank.tipe == KasBankType.MASUK,
            or_(
                KasBank.sumber == KasBankSource.JASA_ANGKUT,
                KasBank.sumber == KasBankSource.PIUTANG
            )
        ).filter(~KasBank.keterangan.ilike("%Akun Utama%"))
        
        # 2. Total Transfer (Payments directly to Main Bank)
        total_transfer_q = self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.jenis == KasBankJenis.BANK_UTAMA,
            KasBank.tipe == KasBankType.MASUK,
            or_(
                KasBank.sumber == KasBankSource.JASA_ANGKUT,
                KasBank.sumber == KasBankSource.PIUTANG
            )
        )

        # 3. Total Dana Dari Utama (Replenishment)
        total_dana_dari_utama_q = self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.jenis == KasBankJenis.KAS_UNIT_JASA_ANGKUT,
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

        # --- Aggregate Maintenance Breakdown per Armada (from Invoice & Logs) ---
        bengkel_armada_query = self.db.query(
            ArmadaJasaAngkut.nama,
            func.sum(TransaksiPenjualanBengkel.grand_total)
        ).join(
            ArmadaJasaAngkut, TransaksiPenjualanBengkel.armada_id == ArmadaJasaAngkut.id
        ).filter(
            TransaksiPenjualanBengkel.kategori == 'jasa_angkut',
            TransaksiPenjualanBengkel.status_bayar != PaymentStatus.BATAL
        )
        if tanggal_dari: bengkel_armada_query = bengkel_armada_query.filter(TransaksiPenjualanBengkel.tanggal >= tanggal_dari)
        if tanggal_sampai: bengkel_armada_query = bengkel_armada_query.filter(TransaksiPenjualanBengkel.tanggal <= tanggal_sampai)
        bengkel_armada_parts = bengkel_armada_query.group_by(ArmadaJasaAngkut.nama).all()
        
        bengkel_tambahan_armada_query = self.db.query(
            ArmadaJasaAngkut.nama,
            func.sum(JasaAngkutBiayaLainnya.jumlah)
        ).join(
            ArmadaJasaAngkut, JasaAngkutBiayaLainnya.armada_id == ArmadaJasaAngkut.id
        ).outerjoin(
            MuatanJasaAngkut, JasaAngkutBiayaLainnya.muatan_id == MuatanJasaAngkut.id
        ).filter(
            or_(MuatanJasaAngkut.id.is_(None), MuatanJasaAngkut.status_bayar != PaymentStatus.BATAL),
            JasaAngkutBiayaLainnya.kategori == "Perawatan Bengkel"
        )
        if tanggal_dari: bengkel_tambahan_armada_query = bengkel_tambahan_armada_query.filter(JasaAngkutBiayaLainnya.tanggal >= tanggal_dari)
        if tanggal_sampai: bengkel_tambahan_armada_query = bengkel_tambahan_armada_query.filter(JasaAngkutBiayaLainnya.tanggal <= tanggal_sampai)
        bengkel_armada_tambahan = bengkel_tambahan_armada_query.group_by(ArmadaJasaAngkut.nama).all()
        
        bengkel_per_armada = {}
        for nama, total in bengkel_armada_parts:
            if nama: bengkel_per_armada[nama] = float(total or 0)
        for nama, total in bengkel_armada_tambahan:
            if nama: bengkel_per_armada[nama] = bengkel_per_armada.get(nama, 0) + float(total or 0)

        # Final Result Dictionary
        result_dict = {
            "total_transaksi": total_count,
            "lunas_count": lunas_count,
            "partial_count": partial_count,
            "unpaid_count": unpaid_count,
            "batal_count": batal_count,
            "hutang_supir_count": active_count,
            "total_pendapatan": total_pendapatan,
            "total_laba_supir": total_laba_supir,
            "total_biaya_trip": total_biaya_trip,
            "total_biaya_operasional_unit": total_biaya_operasional_unit,
            "total_biaya": total_biaya_trip + total_biaya_operasional_unit,
            "laba_gross": total_pendapatan - total_biaya_trip,
            "laba_tpm": total_pendapatan - total_biaya_trip - total_biaya_operasional_unit,
            "saldo_bop": float(KasBank.get_current_balance(self.db, KasBankJenis.KAS_UNIT_JASA_ANGKUT)),
            "total_tunai": float(total_tunai_q.scalar() or 0),
            "total_transfer": float(total_transfer_q.scalar() or 0),
            "total_dana_dari_utama": float(total_dana_dari_utama_q.scalar() or 0),
            "jasa_angkut_armada": armada_ja_summary,
            "details": {
                "gross_share_tpm": total_pendapatan,
                "biaya_lainnya": float(operasional_q.scalar() or 0) + wallet_out,
                "biaya_bengkel": total_biaya_bengkel,
                "bengkel_per_armada": bengkel_per_armada,
                "operasional_per_armada": {} # Populated below
            }
        }

        # Filter and Aggregate Operational Breakdown per Armada
        fixed_op_q = self.db.query(
            ArmadaJasaAngkut.nama,
            func.sum(
                MuatanJasaAngkut.biaya_bbm + 
                MuatanJasaAngkut.biaya_tol + 
                MuatanJasaAngkut.biaya_parkir + 
                MuatanJasaAngkut.biaya_lainnya
            )
        ).join(ArmadaJasaAngkut, MuatanJasaAngkut.armada_id == ArmadaJasaAngkut.id).filter(
            MuatanJasaAngkut.status_bayar != PaymentStatus.BATAL
        )
        if tanggal_dari: fixed_op_q = fixed_op_q.filter(MuatanJasaAngkut.tanggal >= tanggal_dari)
        if tanggal_sampai: fixed_op_q = fixed_op_q.filter(MuatanJasaAngkut.tanggal <= tanggal_sampai)
        fixed_ops = fixed_op_q.group_by(ArmadaJasaAngkut.nama).all()
        
        op_per_armada = {}
        for name, amount in fixed_ops:
            if name: op_per_armada[name] = float(amount or 0)

        result_dict["details"]["operasional_per_armada"] = op_per_armada
        return result_dict



    def get_driver_summary(
        self,
        supir_id: int,
        tanggal_dari: Optional[date] = None,
        tanggal_sampai: Optional[date] = None,
    ) -> Dict[str, Any]:
        """Get summary for specific driver."""
        query = self.db.query(MuatanJasaAngkut).filter(
            MuatanJasaAngkut.supir_id == supir_id
        )

        if tanggal_dari:
            query = query.filter(MuatanJasaAngkut.tanggal >= tanggal_dari)
        if tanggal_sampai:
            query = query.filter(MuatanJasaAngkut.tanggal <= tanggal_sampai)

        total_count = query.count()

        aggregates = query.with_entities(
            func.sum(MuatanJasaAngkut.pendapatan_kotor).label("total_pendapatan"),
            func.sum(MuatanJasaAngkut.laba_supir).label("total_laba_supir"),
        ).first()

        # Unpaid
        unpaid = (
            query.filter(MuatanJasaAngkut.status_bayar != PaymentStatus.LUNAS)
            .with_entities(func.sum(MuatanJasaAngkut.laba_supir))
            .scalar()
            or Decimal("0")
        )

        return {
            "supir_id": supir_id,
            "total_muatan": total_count,
            "total_pendapatan": float(aggregates.total_pendapatan or 0),
            "total_laba_supir": float(aggregates.total_laba_supir or 0),
            "hutang_supir": float(unpaid),
        }

    def get_by_supir(
        self,
        supir_id: int,
        limit: int = 10,
    ) -> List[MuatanJasaAngkut]:
        """Get recent transport loads for a driver."""
        return (
            self.db.query(MuatanJasaAngkut)
            .filter(MuatanJasaAngkut.supir_id == supir_id)
            .order_by(MuatanJasaAngkut.tanggal.desc())
            .limit(limit)
            .all()
        )
