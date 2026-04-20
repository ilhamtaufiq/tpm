from app.utils.constants import AssetStatus
from datetime import date
from decimal import Decimal
from typing import Optional, Dict, Any, List
from sqlalchemy import func, or_, and_, case
from sqlalchemy.orm import Session

from app.services.transaksi_bengkel_service import TransaksiBengkelService
from app.services.pengeluaran_service import PengeluaranService
from app.services.penjualan_mobil_service import PenjualanMobilService
from app.services.muatan_service import MuatanService
from app.services.slip_gaji_service import SlipGajiService

from app.models.bengkel import TransaksiPenjualanBengkel, PengeluaranBengkel, SparePart
from app.models.mobil import Mobil, TransaksiPenjualanMobil
from app.models.jasa_angkut import MuatanJasaAngkut, JasaAngkutPartService, ArmadaJasaAngkut
from app.models.keuangan import KasBank, Aset, PiutangUsaha, HutangUsaha

from app.utils.constants import (
    KasBankSource, 
    KasBankType, 
    KasBankJenis, 
    ExpenseCategory, 
    OwnershipType,
    CarStatus
)

class BaseReportService:
    def __init__(self, db: Session):
        self.db = db

    def get_unit_financial_breakdown(self, tanggal_dari: date, tanggal_sampai: date) -> Dict[str, Any]:
        """
        Unified logic to calculate performance across all business units.
        Source of Truth for all reports.
        """
        # (Using the robust logic developed in previous step)
        bengkel_service = TransaksiBengkelService(self.db)
        bengkel_summary = bengkel_service.get_summary(tanggal_dari, tanggal_sampai)

        pengeluaran_service = PengeluaranService(self.db)
        pengeluaran_summary = pengeluaran_service.get_summary(tanggal_dari, tanggal_sampai)

        mobil_service = PenjualanMobilService(self.db)
        mobil_summary = mobil_service.get_summary(tanggal_dari, tanggal_sampai)

        muatan_service = MuatanService(self.db)
        muatan_summary = muatan_service.get_summary(tanggal_dari, tanggal_sampai)

        slip_gaji_service = SlipGajiService(self.db)
        gaji_summary = slip_gaji_service.get_summary_by_date_range(tanggal_dari, tanggal_sampai)

        def get_wallet_outflow(jenis: KasBankJenis):
            return self.db.query(func.sum(KasBank.nominal)).filter(
                KasBank.jenis == jenis,
                KasBank.tipe == KasBankType.KELUAR,
                KasBank.tanggal >= tanggal_dari,
                KasBank.tanggal <= tanggal_sampai
            ).scalar() or 0

        raw_mobil_outflow = float(get_wallet_outflow(KasBankJenis.KAS_UNIT_MOBIL))
        raw_ja_outflow = float(get_wallet_outflow(KasBankJenis.KAS_UNIT_JASA_ANGKUT))
        raw_bengkel_outflow = float(get_wallet_outflow(KasBankJenis.KAS_UNIT_BENGKEL))

        # MOBIL Logic
        sold_mobil_ids = [str(m.id) for m in self.db.query(Mobil.id).filter(
            Mobil.status == CarStatus.TERJUAL,
            Mobil.tanggal_terjual >= tanggal_dari,
            Mobil.tanggal_terjual <= tanggal_sampai
        ).all()]

        # All expenses tagged to any mobil_id (from any wallet)
        mobil_unit_ledger = self.db.query(
            PengeluaranBengkel.mobil_id,
            PengeluaranBengkel.kategori,
            func.sum(PengeluaranBengkel.jumlah)
        ).filter(
            PengeluaranBengkel.bisnis_kategori.in_(["mobil", "jual_beli_mobil", "penjualan_mobil"]),
            PengeluaranBengkel.mobil_id.is_not(None),
            PengeluaranBengkel.tanggal >= tanggal_dari,
            PengeluaranBengkel.tanggal <= tanggal_sampai
        ).group_by(PengeluaranBengkel.mobil_id, PengeluaranBengkel.kategori).all()

        mobil_detailed_expenses = {}
        for mid, kat, total in mobil_unit_ledger:
            mid_s = str(mid)
            if mid_s not in mobil_detailed_expenses: mobil_detailed_expenses[mid_s] = {}
            mobil_detailed_expenses[mid_s][str(kat)] = float(total or 0)

        hpp_sold_price = float(mobil_summary.get("total_harga_beli", 0))
        hpp_sold_prep = max(0, float(mobil_summary.get("total_modal", 0)) - hpp_sold_price)
        
        new_purchase_ids = {str(m.id) for m in self.db.query(Mobil.id).filter(
            Mobil.tanggal_masuk >= tanggal_dari,
            Mobil.tanggal_masuk <= tanggal_sampai,
            Mobil.deleted_at.is_(None)
        ).all()}

        capital_unsold_purchase = 0
        capital_unsold_prep = 0
        capital_unsold_repairs = 0
        
        # Total value of ALL car stock bought in this period (regardless of sale status)
        total_stock_purchase_period = float(self.db.query(func.sum(Mobil.harga_beli)).filter(
            Mobil.tanggal_masuk >= tanggal_dari,
            Mobil.tanggal_masuk <= tanggal_sampai,
            Mobil.deleted_at.is_(None)
        ).scalar() or 0)
        
        capital_total_prep_period = 0
        capital_total_repairs_period = 0
        
        for mid, cats in mobil_detailed_expenses.items():
            # Ledger-based costs from PengeluaranBengkel (Wallet Outflow)
            prep_ledger = float(cats.get(ExpenseCategory.BIAYA_LAINNYA.value, 0))
            repairs_ledger = float(cats.get(ExpenseCategory.BIAYA_OPERASIONAL.value, 0))
            
            capital_total_prep_period += prep_ledger
            capital_total_repairs_period += repairs_ledger
            
            if mid not in sold_mobil_ids:
                capital_unsold_prep += prep_ledger
                capital_unsold_repairs += repairs_ledger
                if mid in new_purchase_ids:
                    m_obj = self.db.get(Mobil, int(mid))
                    if m_obj: capital_unsold_purchase += float(m_obj.harga_beli or 0)

        # Workshop Bills (Internal Transfer)
        workshop_bills = float(mobil_summary.get("total_biaya_bengkel", 0))
        workshop_bills_unsold = float(mobil_summary.get("total_biaya_bengkel_unsold", 0))
        
        # Repairs Total = Workshop Bills + Repairs from Ledger
        repairs_total_period = workshop_bills + capital_total_repairs_period
        prep_total_period = capital_total_prep_period

        # Repairs stock = workshop bills for unsold cars + ledger repairs for unsold cars
        mobil_total_repairs_unsold = workshop_bills_unsold + capital_unsold_repairs
        mobil_total_repairs_sold = repairs_total_period - mobil_total_repairs_unsold
        
        # WALLET-BASED OPERATIONAL OUTFLOWS (For Capital Report reconciliation)
        # We need to know where the money physically came from
        
        # 1. Bengkel Unit Wallet
        bengkel_wallet_out = float(self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.jenis == KasBankJenis.KAS_UNIT_BENGKEL,
            KasBank.tipe == KasBankType.KELUAR,
            KasBank.sumber == KasBankSource.PENGELUARAN,
            KasBank.tanggal >= tanggal_dari,
            KasBank.tanggal <= tanggal_sampai
        ).scalar() or 0)
        
        # 2. Jasa Angkut Unit Wallet
        ja_wallet_out = float(self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.jenis == KasBankJenis.KAS_UNIT_JASA_ANGKUT,
            KasBank.tipe == KasBankType.KELUAR,
            KasBank.sumber == KasBankSource.PENGELUARAN,
            KasBank.tanggal >= tanggal_dari,
            KasBank.tanggal <= tanggal_sampai
        ).scalar() or 0)
        
        # 3. Mobil Unit Wallet Outflow (Used for overhead partition)
        raw_mobil_outflow = float(self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.jenis == KasBankJenis.KAS_UNIT_MOBIL,
            KasBank.tipe == KasBankType.KELUAR,
            KasBank.tanggal >= tanggal_dari,
            KasBank.tanggal <= tanggal_sampai
        ).scalar() or 0)

        # 4. Total Overall PENGELUARAN (Ledger)
        total_pgl = float(pengeluaran_summary.get("total_pengeluaran", 0))
        
        # Mobil Calculation
        total_mobil_unit_expenses = float(pengeluaran_summary.get("per_unit", {}).get("mobil", 0) + 
                                          pengeluaran_summary.get("per_unit", {}).get("jual_beli_mobil", 0) +
                                          pengeluaran_summary.get("per_unit", {}).get("penjualan_mobil", 0))
        
        total_tagged_from_mobil_ledger = 0
        for mid, cats in pengeluaran_summary.get("mobil_unit", {}).items():
            total_tagged_from_mobil_ledger += sum(float(v) for v in cats.values())
            
        mobil_prive_unit = self.db.query(func.sum(PengeluaranBengkel.jumlah)).filter(
            PengeluaranBengkel.bisnis_kategori.in_(["mobil", "jual_beli_mobil", "penjualan_mobil"]),
            PengeluaranBengkel.kategori == ExpenseCategory.PRIVE,
            PengeluaranBengkel.tanggal >= tanggal_dari,
            PengeluaranBengkel.tanggal <= tanggal_sampai
        ).scalar() or 0
        
        general_mobil_overhead = max(0, total_mobil_unit_expenses - total_tagged_from_mobil_ledger - float(mobil_prive_unit))

        # JA Calculation
        ja_details = muatan_summary.get("details", {})
        ja_expenses_bengkel = float(ja_details.get("biaya_bengkel", 0))
        ja_expenses_trip = float(muatan_summary.get("total_biaya_trip", 0))
        ja_tagged_from_wallet = 0
        for name, cats in pengeluaran_summary.get("jasa_angkut_armada", {}).items():
            ja_tagged_from_wallet += sum(float(v) for v in cats.values())
        ja_prive_unit = self.db.query(func.sum(PengeluaranBengkel.jumlah)).filter(
            PengeluaranBengkel.bisnis_kategori == "jasa_angkut",
            PengeluaranBengkel.kategori == ExpenseCategory.PRIVE,
            PengeluaranBengkel.tanggal >= tanggal_dari,
            PengeluaranBengkel.tanggal <= tanggal_sampai
        ).scalar() or 0
        
        # POOL shared
        p_cat = pengeluaran_summary["per_kategori"].get(ExpenseCategory.PRIVE.value.lower(), {})
        prive_total = float(p_cat.get("total", 0) if isinstance(p_cat, dict) else p_cat)
        mobil_entity_total = (
            float(pengeluaran_summary["per_unit"].get("mobil", 0)) + 
            float(pengeluaran_summary["per_unit"].get("jual_beli_mobil", 0)) + 
            float(pengeluaran_summary["per_unit"].get("penjualan_mobil", 0))
        )
        ja_entity_total = float(pengeluaran_summary["per_unit"].get("jasa_angkut", 0))
        
        general_ja_overhead = max(0, ja_entity_total - ja_tagged_from_wallet - float(ja_prive_unit))
        
        # Calculate leftover untagged expenses across the entire ledger
        common_expenses = (
            float(pengeluaran_summary["total_pengeluaran"] or 0) - 
            mobil_entity_total - 
            ja_entity_total - 
            float(pengeluaran_summary["per_unit"].get("bengkel", 0)) -
            float(pengeluaran_summary["per_unit"].get("umum", 0)) -
            prive_total
        )

        b_prive_unit = self.db.query(func.sum(PengeluaranBengkel.jumlah)).filter(
            PengeluaranBengkel.bisnis_kategori == "bengkel",
            PengeluaranBengkel.kategori == ExpenseCategory.PRIVE,
            PengeluaranBengkel.tanggal >= tanggal_dari,
            PengeluaranBengkel.tanggal <= tanggal_sampai
        ).scalar() or 0

        bengkel_ops_total = max(0, float(pengeluaran_summary["per_unit"].get("bengkel", 0)) - float(b_prive_unit))
        bengkel_common = max(0, float(pengeluaran_summary["per_unit"].get("umum", 0)) + common_expenses)

        ja_revenue_tpm = float(muatan_summary.get("total_pendapatan", 0))
        raw_bengkel_outflow = bengkel_wallet_out
        raw_ja_outflow = ja_wallet_out


        # Assets & Stock (Simplified snapshot)
        aset_tetap = float(self.db.query(func.sum(Aset.harga_beli)).filter(Aset.status == AssetStatus.AKTIF).scalar() or 0)
        aset_persediaan = float(self.db.query(func.sum(SparePart.stok * SparePart.harga_beli)).scalar() or 0)

        # Piutang (Cumulative as of end date)
        piutang_usaha = float(self.db.query(func.sum(PiutangUsaha.sisa_piutang)).filter(PiutangUsaha.tanggal <= tanggal_sampai).scalar() or 0)
        hutang_total = float(self.db.query(func.sum(HutangUsaha.sisa_hutang)).filter(HutangUsaha.tanggal <= tanggal_sampai).scalar() or 0)


        return {
            "periode": {"dari": tanggal_dari, "sampai": tanggal_sampai},
            "revenue": {
                "bengkel": float(bengkel_summary["total_penjualan"]),
                "mobil": float(mobil_summary["total_penjualan"]),
                "jasa_angkut": float(muatan_summary["total_pendapatan"]),
                "total": float(bengkel_summary["total_penjualan"] + mobil_summary["total_penjualan"] + muatan_summary["total_pendapatan"])
            },
            "units": {
                "mobil": {
                    "purchase_hpp": hpp_sold_price,
                    "prep_hpp": hpp_sold_prep,
                    "stock_purchase_period": total_stock_purchase_period,
                    "purchase_stock_period": capital_unsold_purchase,
                    "prep_stock_period": capital_unsold_prep + mobil_total_repairs_unsold,
                    "repairs": mobil_total_repairs_sold,
                    "repairs_total": repairs_total_period,
                    "prep_total": prep_total_period,
                    "overhead": general_mobil_overhead,
                    "total_outflow_wallet": raw_mobil_outflow,
                    "prive": float(mobil_prive_unit)
                },
                "jasa_angkut": {
                    "revenue_tpm": ja_revenue_tpm,
                    "repairs": ja_expenses_bengkel,
                    "armada_ops": float(ja_details.get("armada_period_ops", 0)),
                    "armada_ops_ledger": ja_tagged_from_wallet,
                    "trip_costs": ja_expenses_trip,
                    "overhead": general_ja_overhead,
                    "total_outflow_wallet": raw_ja_outflow,
                    "prive": float(ja_prive_unit)
                },
                "bengkel": {
                    "laba_kotor": float(bengkel_summary["total_laba_kotor"]),
                    "total_hpp": float(bengkel_summary["total_hpp"]),
                    "common_expenses": bengkel_common,
                    "total_expenses": bengkel_ops_total,
                    "gaji": float(gaji_summary["total"]),
                    "total_outflow_wallet": raw_bengkel_outflow,
                    "prive": float(b_prive_unit)
                }
            },
            "assets": {
                "tetap": aset_tetap,
                "persediaan": aset_persediaan
            },
            "prive_global": prive_total,
            "raw_summaries": {
                "bengkel": bengkel_summary,
                "pengeluaran": pengeluaran_summary,
                "mobil": mobil_summary,
                "muatan": muatan_summary,
                "gaji": gaji_summary
            }
        }

