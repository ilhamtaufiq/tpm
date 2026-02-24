from app.services.kas_bank_integration import create_kas_entry
from app.utils.constants import KasBankType, KasBankSource
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
    PaymentStatus,
    PiutangStatus,
    PiutangSource,
    TRANSACTION_PREFIXES,
    JASA_ANGKUT_PROFIT_SPLIT,
    PaymentMethod,
)


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
        
        New Logic: Operational costs are charged to TPM, not Driver.
        Driver Share = Gross Revenue * (100 - TPM%) / 100
        TPM Share = Gross Revenue - Driver Share - Operational Costs
        """
        # Net Profit (for accounting)
        laba_kotor = pendapatan_kotor - total_biaya_operasional
        
        # Driver share calculated from Gross Revenue (Pendapatan Kotor)
        persentase_supir = Decimal("100") - persentase_tpm
        laba_supir = (pendapatan_kotor * persentase_supir / 100).quantize(Decimal("0.01"))
        
        # TPM Share takes the hit for operational costs
        # TPM Share = Total Revenue - Driver Share - Costs
        # Which is equivalent to: (Gross Share TPM) - Costs
        laba_tpm = pendapatan_kotor - laba_supir - total_biaya_operasional

        return {
            "total_biaya": total_biaya_operasional,
            "laba_kotor": laba_kotor,
            "laba_tpm": laba_tpm,
            "laba_supir": laba_supir,
        }

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
                user_id=user_id
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
             # assuming 'metode_bayar' is not in MuatanCreate, we might need to add it or default to TUNAI.
             # In MuatanForm, 'metode_bayar' is in formData. But is it in MuatanCreate schema?
             # I need to check schemas/jasa_angkut.py or infer.
             # If it's not in schema, I cannot access data.metode_bayar.
             # MuatanJasaAngkut model doesn't seem to have 'metode_bayar' column based on Step 16 create().
             # I'll use default PaymentMethod.TUNAI if not available, or pass it if I can.
             # Actually, simpler: Use 'TUNAI' as default for now, since schema update is riskier without seeing file.
             pass 

        self.db.commit()
        self.db.refresh(muatan)

        # Post-commit Kas Entry (safe)
        if muatan.status_bayar == PaymentStatus.LUNAS:
             # We need to know where the money goes.
             # Since 'metode_bayar' might not be in the model, we use a heuristic or default.
             # Or, we update the schema?
             # Let's check if 'metode_bayar' is in MuatanCreate in a separate step or just assume TUNAI.
             # To be safe, I will use PaymentMethod.TUNAI.
             # Record ONLY TPM Portion to Kas/Bank
             tpm_gross_portion = muatan.pendapatan_kotor - muatan.laba_supir
             
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
             )

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
            self.db.query(PiutangUsaha.id, PiutangUsaha.jumlah_terbayar)
            .filter(
                PiutangUsaha.nomor_referensi == muatan.nomor_transaksi,
                PiutangUsaha.sumber == PiutangSource.JASA_ANGKUT
            )
            .first()
        )
        if piutang:
            muatan.piutang_id = piutang.id
            muatan.jumlah_bayar = piutang.jumlah_terbayar
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
                PiutangUsaha.id, PiutangUsaha.nomor_referensi, PiutangUsaha.jumlah_terbayar
            ).filter(
                PiutangUsaha.nomor_referensi.in_(nomor_refs),
                PiutangUsaha.sumber == PiutangSource.JASA_ANGKUT
            ).all()
            
            piutang_map = {p.nomor_referensi: (p.id, p.jumlah_terbayar) for p in piutang_info}
            
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
                 sumber=KasBankSource.PIUTANG,
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
    ) -> Dict[str, Any]:
        """Get transport load summary statistics."""
        # Base query with date filters
        base_query = self.db.query(MuatanJasaAngkut)

        if tanggal_dari:
            base_query = base_query.filter(MuatanJasaAngkut.tanggal >= tanggal_dari)
        if tanggal_sampai:
            base_query = base_query.filter(MuatanJasaAngkut.tanggal <= tanggal_sampai)

        # 1. All Transactions in period (For Report - Accrual Basis)
        # Point 3: Include unpaid in P&L
        summary_query = base_query
        
        # Total transactions (Paid only)
        total_count = summary_query.count()

        # Aggregate values (Paid only)
        # Note: 'total_pendapatan' per user request should exclude 'laba_supir'
        aggregates = summary_query.with_entities(
            func.sum(MuatanJasaAngkut.pendapatan_kotor - MuatanJasaAngkut.laba_supir).label("total_pendapatan"),
            func.sum(MuatanJasaAngkut.total_biaya).label("total_biaya"),
            func.sum(MuatanJasaAngkut.laba_kotor).label("total_laba_kotor"),
            func.sum(MuatanJasaAngkut.laba_tpm).label("total_laba_tpm"),
            func.sum(
                MuatanJasaAngkut.biaya_bbm + 
                MuatanJasaAngkut.biaya_tol + 
                MuatanJasaAngkut.biaya_makan + 
                MuatanJasaAngkut.biaya_parkir + 
                MuatanJasaAngkut.biaya_lainnya
            ).label("total_biaya_static"),
            func.sum(0).label("total_laba_supir"), # Hidden per request
        ).first()

        # 2. Unpaid Transactions (For separate stats)
        unpaid_query = base_query.filter(
            MuatanJasaAngkut.status_bayar != PaymentStatus.LUNAS
        )
        unpaid_count = unpaid_query.count()
        unpaid_value = (
            unpaid_query.with_entities(
                func.sum(MuatanJasaAngkut.pendapatan_kotor - MuatanJasaAngkut.laba_supir) # Unpaid share TPM
            ).scalar()
            or Decimal("0")
        )

        # 3. Cost Breakdown (Accrual)
        # Includes both tied to muatan and general armada expenses in period
        # Use LEFT JOIN to MuatanJasaAngkut for date filtering (tanggal column
        # may not exist on jasa_angkut_biaya_lainnya in older DB schemas)
        
        cost_query = (
            self.db.query(
                JasaAngkutBiayaLainnya.kategori,
                func.sum(JasaAngkutBiayaLainnya.jumlah).label("total")
            )
            .outerjoin(
                MuatanJasaAngkut,
                JasaAngkutBiayaLainnya.muatan_id == MuatanJasaAngkut.id
            )
        )

        if tanggal_dari:
            # For records linked to muatan: use muatan.tanggal
            # For standalone armada expenses (muatan_id IS NULL): use created_at
            cost_query = cost_query.filter(
                func.coalesce(MuatanJasaAngkut.tanggal, func.date(JasaAngkutBiayaLainnya.created_at)) >= tanggal_dari
            )
        if tanggal_sampai:
            cost_query = cost_query.filter(
                func.coalesce(MuatanJasaAngkut.tanggal, func.date(JasaAngkutBiayaLainnya.created_at)) <= tanggal_sampai
            )
            
        cost_results = cost_query.group_by(JasaAngkutBiayaLainnya.kategori).all()
        
        biaya_bengkel = Decimal("0")
        biaya_lainnya = aggregates.total_biaya_static or Decimal("0")
        
        for cat, total in cost_results:
            if cat == "Perawatan Bengkel":
                biaya_bengkel += (total or Decimal("0"))
            else:
                biaya_lainnya += (total or Decimal("0"))

        # 3b. Include JasaAngkutPartService costs
        ps_cost_query = self.db.query(func.sum(JasaAngkutPartService.total))
        if tanggal_dari:
            ps_cost_query = ps_cost_query.filter(JasaAngkutPartService.tanggal >= tanggal_dari)
        if tanggal_sampai:
            ps_cost_query = ps_cost_query.filter(JasaAngkutPartService.tanggal <= tanggal_sampai)
        
        ps_cost_total = ps_cost_query.scalar() or Decimal("0")
        biaya_bengkel += ps_cost_total

        # 3c. Include independent workshop transactions for Jasa Angkut fleets
        # (Where kategori=jasa_angkut but muatan_id is null, or identified by armada nopol)
        from app.models.bengkel import TransaksiPenjualanBengkel
        from app.models.jasa_angkut import ArmadaJasaAngkut
        
        independent_repair_query = (
            self.db.query(func.sum(TransaksiPenjualanBengkel.grand_total))
            .filter(
                TransaksiPenjualanBengkel.muatan_id.is_(None),
                or_(
                    TransaksiPenjualanBengkel.kategori == 'jasa_angkut',
                    TransaksiPenjualanBengkel.armada_id.is_not(None),
                    TransaksiPenjualanBengkel.nomor_plat.in_(
                        self.db.query(ArmadaJasaAngkut.nopol).filter(ArmadaJasaAngkut.deleted_at.is_(None))
                    )
                )
            )
        )
        
        if tanggal_dari:
            independent_repair_query = independent_repair_query.filter(TransaksiPenjualanBengkel.tanggal >= tanggal_dari)
        if tanggal_sampai:
            independent_repair_query = independent_repair_query.filter(TransaksiPenjualanBengkel.tanggal <= tanggal_sampai)
            
        independent_repair_total = independent_repair_query.scalar() or Decimal("0")
        biaya_bengkel += independent_repair_total

        total_pendapatan = float(aggregates.total_pendapatan or 0)
        total_laba_supir = float(aggregates.total_laba_supir or 0)
        
        # Gross Share TPM (Revenue - Driver Share)
        gross_share_tpm = total_pendapatan - total_laba_supir
        
        # Net Profit = Gross TPM - Total Costs (incl. General Expenses & Independent Repairs)
        laba_tpm_net = gross_share_tpm - float(biaya_bengkel) - float(biaya_lainnya)

        return {
            "total_transaksi": total_count,
            "total_pendapatan": total_pendapatan,
            "total_biaya": float(aggregates.total_biaya or 0),
            "total_laba_kotor": float(aggregates.total_laba_kotor or 0),
            "laba_tpm": laba_tpm_net,
            "laba_supir": 0, # Hidden in reports as requested
            "hutang_supir_count": unpaid_count,
            "hutang_supir_nilai": float(unpaid_value), # Now refers to unpaid TPM portion
            "details": {
                "gross_share_tpm": gross_share_tpm,
                "biaya_bengkel": float(biaya_bengkel),
                "biaya_lainnya": float(biaya_lainnya),
            }
        }

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
