from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi import HTTPException, status

from app.models.jasa_angkut import ArmadaJasaAngkut, MuatanJasaAngkut
from app.models.bengkel import TransaksiPenjualanBengkel, PengeluaranBengkel
from app.schemas.jasa_angkut import (
    ArmadaCreate, 
    ArmadaUpdate, 
    ArmadaDetailResponse, 
    ArmadaStats,
    ArmadaExpenseCreate
)
from decimal import Decimal
from app.models.jasa_angkut import JasaAngkutBiayaLainnya
from app.services.kas_bank_integration import create_kas_entry
from app.utils.constants import KasBankType, KasBankSource, PaymentMethod, TRANSACTION_PREFIXES, ExpenseCategory
from datetime import date, datetime

class ArmadaService:
    """Service for armada management."""

    def __init__(self, db: Session):
        self.db = db

    def _generate_pengeluaran_nomor(self) -> str:
        """Generate unique expense transaction number."""
        today = datetime.now()
        prefix = TRANSACTION_PREFIXES["pengeluaran"]
        date_str = today.strftime("%y%m%d")

        last = (
            self.db.query(PengeluaranBengkel)
            .filter(PengeluaranBengkel.nomor_transaksi.like(f"{prefix}{date_str}%"))
            .order_by(PengeluaranBengkel.id.desc())
            .first()
        )

        if last:
            last_num = int(last.nomor_transaksi[-4:])
            new_num = last_num + 1
        else:
            new_num = 1

        return f"{prefix}{date_str}{new_num:04d}"


    def create(self, data: ArmadaCreate) -> ArmadaJasaAngkut:
        """Create a new armada."""
        existing = self.db.query(ArmadaJasaAngkut).filter(
            ArmadaJasaAngkut.nopol == data.nopol,
            ArmadaJasaAngkut.deleted_at.is_(None)
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Armada dengan nopol '{data.nopol}' sudah ada",
            )

        armada = ArmadaJasaAngkut(**data.model_dump())
        self.db.add(armada)
        self.db.commit()
        self.db.refresh(armada)
        return armada

    def get_by_id(self, armada_id: int) -> ArmadaJasaAngkut:
        """Get armada by ID."""
        armada = self.db.query(ArmadaJasaAngkut).filter(
            ArmadaJasaAngkut.id == armada_id,
            ArmadaJasaAngkut.deleted_at.is_(None)
        ).first()
        if not armada:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Armada tidak ditemukan",
            )
        return armada

    def get_list(
        self,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """Get list of armada with pagination and filters."""
        query = self.db.query(ArmadaJasaAngkut).filter(ArmadaJasaAngkut.deleted_at.is_(None))

        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                or_(
                    ArmadaJasaAngkut.nama.ilike(search_filter),
                    ArmadaJasaAngkut.nopol.ilike(search_filter),
                )
            )

        if is_active is not None:
            query = query.filter(ArmadaJasaAngkut.is_active == is_active)

        total = query.count()
        armadas = query.order_by(ArmadaJasaAngkut.nama.asc()).offset(skip).limit(limit).all()
        pages = (total + limit - 1) // limit if limit > 0 else 1

        return {
            "data": armadas,
            "total": total,
            "page": (skip // limit) + 1 if limit > 0 else 1,
            "size": limit,
            "pages": pages,
        }

    def update(self, armada_id: int, data: ArmadaUpdate) -> ArmadaJasaAngkut:
        """Update armada information."""
        armada = self.get_by_id(armada_id)
        update_data = data.model_dump(exclude_unset=True)

        if "nopol" in update_data and update_data["nopol"] != armada.nopol:
            existing = self.db.query(ArmadaJasaAngkut).filter(
                ArmadaJasaAngkut.nopol == update_data["nopol"],
                ArmadaJasaAngkut.id != armada_id,
                ArmadaJasaAngkut.deleted_at.is_(None)
            ).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Armada dengan nopol '{update_data['nopol']}' sudah ada",
                )

        for field, value in update_data.items():
            setattr(armada, field, value)

        self.db.commit()
        self.db.refresh(armada)
        return armada

    def delete(self, armada_id: int) -> bool:
        """Soft delete armada."""
        armada = self.get_by_id(armada_id)

        # Check if has trips
        has_trips = self.db.query(MuatanJasaAngkut).filter(
            MuatanJasaAngkut.armada_id == armada_id
        ).first()
        if has_trips:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tidak dapat menghapus armada yang memiliki riwayat transaksi",
            )

        from datetime import datetime
        armada.deleted_at = datetime.utcnow()
        self.db.commit()
        return True

    def get_active_armada(self) -> List[ArmadaJasaAngkut]:
        """Get all active armada for dropdown."""
        return self.db.query(ArmadaJasaAngkut).filter(
            ArmadaJasaAngkut.deleted_at.is_(None),
            ArmadaJasaAngkut.is_active == True
        ).order_by(ArmadaJasaAngkut.nama.asc()).all()

    def get_detail(self, armada_id: int) -> Dict[str, Any]:
        """Get exhaustive detail for an armada."""
        armada = self.get_by_id(armada_id)
        
        from sqlalchemy.orm import selectinload
        muatan_history = self.db.query(MuatanJasaAngkut).options(
            selectinload(MuatanJasaAngkut.biaya_tambahan),
            selectinload(MuatanJasaAngkut.part_services)
        ).filter(
            MuatanJasaAngkut.armada_id == armada_id
        ).order_by(MuatanJasaAngkut.tanggal.desc()).limit(50).all()
        
        # 2. Workshop repairs history (by nopol or by muatan link or by direct armada_id)
        muatan_ids = [m.id for m in muatan_history]
        perbaikan_history = self.db.query(TransaksiPenjualanBengkel).filter(
            or_(
                TransaksiPenjualanBengkel.armada_id == armada_id,
                TransaksiPenjualanBengkel.nomor_plat == armada.nopol,
                TransaksiPenjualanBengkel.muatan_id.in_(muatan_ids) if muatan_ids else False
            )
        ).order_by(TransaksiPenjualanBengkel.tanggal.desc()).limit(50).all()
        
        # 3. General Armada Expenses (not tied to muatan)
        general_expenses = self.db.query(JasaAngkutBiayaLainnya).filter(
            JasaAngkutBiayaLainnya.armada_id == armada_id,
            JasaAngkutBiayaLainnya.muatan_id.is_(None)
        ).order_by(JasaAngkutBiayaLainnya.created_at.desc()).all()

        # 4. Workshop Operational Expenses (linked directly from Workshop module)
        workshop_expenses = self.db.query(PengeluaranBengkel).filter(
            PengeluaranBengkel.armada_id == armada_id
        ).order_by(PengeluaranBengkel.tanggal.desc()).all()

        # 4. Calculate Stats
        stats = ArmadaStats()
        stats.total_muatan = len(muatan_history)
        
        # Track linked muatans to avoid double counting perbaikan
        linked_muatan_ids = {p.muatan_id for p in perbaikan_history if p.muatan_id}
        
        for m in muatan_history:
            stats.total_ritase += m.ritase or 0
            
            # Pendapatan: Share TPM saja (Pendapatan Kotor - Laba Supir)
            share_supir = m.laba_supir or Decimal("0")
            pendapatan_kotor = m.pendapatan_kotor or Decimal("0")
            stats.total_pendapatan_kotor += (pendapatan_kotor - share_supir)
            
            # Biaya Ops: Hanya biaya operasional dinamis, keluarkan maintenance/parts muatan
            # Juga keluarkan biaya tambahan dengan kategori 'Perawatan Bengkel'
            maintenance_in_muatan = sum(ps.total for ps in m.part_services) if m.part_services else Decimal("0")
            bengkel_cat_costs = sum(b.jumlah for b in m.biaya_tambahan if b.kategori == "Perawatan Bengkel") if m.biaya_tambahan else Decimal("0")
            
            m_perbaikan = maintenance_in_muatan + bengkel_cat_costs
            stats.total_biaya_operasional += (m.total_biaya - m_perbaikan) if m.total_biaya else Decimal("0")
            
            # Masukkan ke total perbaikan HANYA jika muatan ini tidak terhubung ke transaksi bengkel di perbaikan_history
            # (untuk menghindari double counting karena transaksi bengkel akan dihitung di loop berikutnya)
            if m.id not in linked_muatan_ids:
                stats.total_perbaikan_bengkel += m_perbaikan
            
            stats.total_laba_tpm += m.laba_tpm or 0
            
        for p in perbaikan_history:
            stats.total_perbaikan_bengkel += p.grand_total or 0
            # If not tied to muatan, deduct directly from net profit
            if not p.muatan_id:
                stats.total_laba_tpm -= p.grand_total or 0
        
        # Add general expenses to total biaya operasional
        for ge in general_expenses:
            stats.total_biaya_operasional += ge.jumlah or 0
            # Since total_laba_tpm was aggregated from muatan, we must deduct general expenses from it
            stats.total_laba_tpm -= ge.jumlah or 0
            
        # Add workshop expenses to total biaya operasional
        for we in workshop_expenses:
            stats.total_biaya_operasional += we.jumlah or 0
            stats.total_laba_tpm -= we.jumlah or 0
            
        return {
            "armada": armada,
            "stats": stats,
            "muatan_history": muatan_history,
            "perbaikan_history": perbaikan_history,
            "general_expenses": general_expenses,
            "workshop_expenses": workshop_expenses
        }

    def add_expense(self, armada_id: int, data: ArmadaExpenseCreate, user_id: Optional[int] = None) -> PengeluaranBengkel:
        """Add a general expense to an armada."""
        armada = self.get_by_id(armada_id)
        
        # Create a unified PengeluaranBengkel record instead of JasaAngkutBiayaLainnya
        nomor_transaksi = self._generate_pengeluaran_nomor()
        
        expense = PengeluaranBengkel(
            nomor_transaksi=nomor_transaksi,
            tanggal=data.tanggal,
            bisnis_kategori="jasa_angkut",
            armada_id=armada_id,
            kategori=ExpenseCategory.BIAYA_OPERASIONAL,
            deskripsi=data.deskripsi,
            jumlah=data.jumlah,
            catatan=data.catatan,
            created_by=user_id
        )
        
        self.db.add(expense)
        self.db.flush()
        
        # Record to Kas/Bank
        if data.payments:
            for payment in data.payments:
                if payment.nominal > 0:
                    create_kas_entry(
                        db=self.db,
                        tanggal=data.tanggal,
                        tipe=KasBankType.KELUAR,
                        nominal=payment.nominal,
                        sumber=KasBankSource.JASA_ANGKUT,
                        metode_bayar=payment.metode,
                        referensi_id=expense.id,
                        nomor_referensi=nomor_transaksi,
                        keterangan=f"Biaya Ops Jasa Angkut ({payment.metode.upper()}) - {armada.nopol}: {data.deskripsi}",
                        user_id=user_id,
                    )
        else:
            create_kas_entry(
                db=self.db,
                tanggal=data.tanggal,
                tipe=KasBankType.KELUAR,
                nominal=data.jumlah,
                sumber=KasBankSource.JASA_ANGKUT,
                metode_bayar=data.metode_bayar or PaymentMethod.TUNAI,
                referensi_id=expense.id,
                nomor_referensi=nomor_transaksi,
                keterangan=f"Biaya Ops Jasa Angkut - {armada.nopol}: {data.deskripsi}",
                user_id=user_id,
            )
        
        self.db.commit()
        self.db.refresh(expense)
        return expense
