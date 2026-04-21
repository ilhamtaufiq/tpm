from app.utils.constants import HutangSource, AssetStatus
from app.models import PembayaranHutang
from app.services.pembelian_part_service import PembelianPartService
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Optional, Dict, Any, List
from sqlalchemy import func, or_, and_, case
from sqlalchemy.orm import Session

from app.services.transaksi_bengkel_service import TransaksiBengkelService
from app.services.pengeluaran_service import PengeluaranService
from app.services.penjualan_mobil_service import PenjualanMobilService
from app.services.muatan_service import MuatanService
from app.services.slip_gaji_service import SlipGajiService
from app.services.kas_bank_service import KasBankService

from app.models.bengkel import TransaksiPenjualanBengkel, PengeluaranBengkel, SparePart
from app.models.mobil import Mobil, TransaksiPenjualanMobil
from app.models.jasa_angkut import MuatanJasaAngkut, JasaAngkutPartService, ArmadaJasaAngkut
from app.models.keuangan import KasBank, Aset, PiutangUsaha, HutangUsaha

from app.utils.constants import (
    KasBankSource, 
    KasBankType, 
    KasBankJenis,
    PaymentStatus,
    ExpenseCategory, 
    OwnershipType,
    CarStatus,
    PaymentMethod
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

        # Correct Opening Balance (Total system balance as of start of day)
        kas_bank_service = KasBankService(self.db)
        closing_yesterday = tanggal_dari - timedelta(days=1)
        opening_summary = kas_bank_service.get_all_balances(as_of=closing_yesterday)
        saldo_awal = opening_summary.get("total_saldo", 0)

        pengeluaran_service = PengeluaranService(self.db)
        pengeluaran_summary = pengeluaran_service.get_summary(tanggal_dari, tanggal_sampai)

        pembelian_part_service = PembelianPartService(self.db)
        pembelian_part_summary = pembelian_part_service.get_summary(tanggal_dari, tanggal_sampai)

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
        sold_mobil_ids = [m.id for m in self.db.query(Mobil.id).filter(
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

        hpp_sold_price = float(mobil_summary.get("total_harga_beli", 0))
        hpp_sold_prep = max(0, float(mobil_summary.get("total_modal", 0)) - hpp_sold_price)
        
        new_purchase_ids = {m.id for m in self.db.query(Mobil.id).filter(
            Mobil.tanggal_masuk >= tanggal_dari,
            Mobil.tanggal_masuk <= tanggal_sampai,
            Mobil.deleted_at.is_(None)
        ).all()}

        # Fix: capital_unsold_purchase should be ALL unsold cars bought in this period
        # not just those with detailed expenses.
        capital_unsold_purchase = float(self.db.query(func.sum(Mobil.harga_beli)).filter(
            Mobil.id.in_(list(new_purchase_ids)),
            Mobil.id.notin_(list(sold_mobil_ids))
        ).scalar() or 0)

        # Workshop Bills (Internal Transfer)
        workshop_bills = float(mobil_summary.get("total_biaya_bengkel", 0))
        workshop_bills_unsold = float(mobil_summary.get("total_biaya_bengkel_unsold", 0))
        
        capital_unsold_prep = 0
        capital_unsold_repairs = 0
        
        # Total value of ALL car stock bought in this period (regardless of sale status)
        total_stock_purchase_period = float(self.db.query(func.sum(Mobil.harga_beli)).filter(
            or_(
                and_(Mobil.tanggal_masuk >= tanggal_dari, Mobil.tanggal_masuk <= tanggal_sampai),
                and_(func.date(Mobil.created_at) >= tanggal_dari, func.date(Mobil.created_at) <= tanggal_sampai)
            ),
            Mobil.deleted_at.is_(None)
        ).scalar() or 0)

        # Unpaid portion (Hutang) for those purchases
        purchase_stock_unpaid = float(self.db.query(func.sum(HutangUsaha.nominal_hutang)).filter(
            HutangUsaha.sumber == HutangSource.PEMBELIAN_MOBIL,
            HutangUsaha.created_at >= tanggal_dari,
            HutangUsaha.created_at <= (datetime.combine(tanggal_sampai, time.max) if isinstance(tanggal_sampai, date) else tanggal_sampai)
        ).scalar() or 0)
        
        capital_total_prep_period = 0
        capital_total_repairs_period = 0
        
        mobil_detailed_expenses = {}
        for mid, kat, total in mobil_unit_ledger:
            if mid not in mobil_detailed_expenses: mobil_detailed_expenses[mid] = {}
            mobil_detailed_expenses[mid][str(kat)] = float(total or 0)
        
        # Identify double-counted JA expenses
        # (Where user records a manual Keluar for a cost already inside 'total_biaya' of a trip)
        ja_double_exp = float(self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.tipe == KasBankType.KELUAR,
            KasBank.sumber == KasBankSource.JASA_ANGKUT,
            KasBank.keterangan.ilike("Biaya Operational Muatan %"),
            KasBank.tanggal >= tanggal_dari,
            KasBank.tanggal <= tanggal_sampai
        ).scalar() or 0)

        
        # Actually, let's just find ALL Jasa Angkut manual operational expenses that should be ignored
        # to avoid double deduction from net profit.
        
        capital_total_prep_period = 0
        capital_total_repairs_period = 0
        capital_unsold_prep = 0
        capital_unsold_repairs = 0
        
        for mid, cats in mobil_detailed_expenses.items():
            # Ledger-based costs from PengeluaranBengkel (Wallet Outflow)
            prep_ledger = float(cats.get(ExpenseCategory.BIAYA_LAINNYA.value, 0))
            repairs_ledger = float(cats.get(ExpenseCategory.BIAYA_OPERASIONAL.value, 0))
            
            capital_total_prep_period += prep_ledger
            capital_total_repairs_period += repairs_ledger
            
            if mid not in sold_mobil_ids:
                capital_unsold_prep += prep_ledger
                capital_unsold_repairs += repairs_ledger

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
        
        # Identify Post-Sale Expenses (expenses added to a car AFTER it was sold)
        # These are effectively period expenses because they weren't capitalized in HPP.
        post_sale_mobil_expenses = float(self.db.query(func.sum(PengeluaranBengkel.jumlah)).join(Mobil).filter(
            PengeluaranBengkel.bisnis_kategori.in_(["mobil", "jual_beli_mobil", "penjualan_mobil"]),
            PengeluaranBengkel.tanggal > Mobil.tanggal_terjual,
            PengeluaranBengkel.tanggal >= tanggal_dari,
            PengeluaranBengkel.tanggal <= tanggal_sampai
        ).scalar() or 0)

        # Identify double-counted Car expenses
        # (Where an expense is in both mobil_biaya_lainnya AND pengeluaran_bengkel)
        # We subtract tagged expenses from the total to prevent double deduction.
        general_mobil_overhead = max(0, total_mobil_unit_expenses - total_tagged_from_mobil_ledger - float(mobil_prive_unit) + post_sale_mobil_expenses)

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
        prive_total_ledger = float(p_cat.get("total", 0) if isinstance(p_cat, dict) else p_cat)
        
        # Robust Prive Check: Scan KasBank for entries that might be missing from the ledger 
        # (Where user records a payout but forgets the matching Journal entry)
        prive_unrecorded = float(self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.tipe == KasBankType.KELUAR,
            or_(
                KasBank.keterangan.ilike("Pencairan %"),
                KasBank.keterangan.ilike("Prive %"),
                KasBank.keterangan.ilike("%pembagian laba%")
            ),
            KasBank.tanggal >= tanggal_dari,
            KasBank.tanggal <= tanggal_sampai
        ).scalar() or 0)
        
        prive_total = max(prive_total_ledger, prive_unrecorded)

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


        # Assets & Stock (Snapshot as of tanggal_sampai)
        aset_tetap = float(self.db.query(func.sum(Aset.harga_beli)).filter(
            Aset.status == AssetStatus.AKTIF,
            Aset.tanggal_beli <= tanggal_sampai
        ).scalar() or 0)
        
        # Part Stock
        part_stock = float(self.db.query(func.sum(SparePart.stok * SparePart.harga_beli)).scalar() or 0)
        # Car Stock (Available as of date: masuk <= sampai AND (keluar is null OR keluar > sampai))
        # Total Capitalized Value = Purchase Price + Prep + Repairs for unsold cars
        car_stock = float(self.db.query(func.sum(Mobil.harga_beli)).filter(
            Mobil.tanggal_masuk <= tanggal_sampai,
            or_(Mobil.tanggal_terjual.is_(None), Mobil.tanggal_terjual > tanggal_sampai),
            Mobil.deleted_at.is_(None)
        ).scalar() or 0)
        
        # Add improvement costs (Prep & Repairs) to unsold car stock value
        # to ensure they are treated as Assets (Inventory) rather than Period Expenses.
        car_stock += (capital_unsold_prep + mobil_total_repairs_unsold)
        
        aset_persediaan = part_stock + car_stock

        # Piutang (Cumulative as of end date)
        piutang_usaha = float(self.db.query(func.sum(PiutangUsaha.sisa_piutang)).filter(PiutangUsaha.tanggal <= tanggal_sampai).scalar() or 0)
        
        # Robust point-in-time Debt calculation (Nominal - Paid up to date)
        def get_debt_balance_at_date(source_list: list) -> float:
            # 1. Main HutangUsaha table
            nominal = self.db.query(func.sum(HutangUsaha.nominal_hutang)).filter(
                HutangUsaha.sumber.in_(source_list),
                HutangUsaha.tanggal <= tanggal_sampai
            ).scalar() or 0
            
            paid = self.db.query(func.sum(PembayaranHutang.nominal)).join(HutangUsaha).filter(
                HutangUsaha.sumber.in_(source_list),
                PembayaranHutang.tanggal <= tanggal_sampai
            ).scalar() or 0
            
            total_hu = float(nominal - paid)

            # 2. Accrued Expenses from PengeluaranBengkel (If source is LAINNYA)
            total_accrued = 0
            if HutangSource.LAINNYA in source_list:
                # Sum of all KREDIT expenses
                nominal_accrued = self.db.query(func.sum(PengeluaranBengkel.jumlah)).filter(
                    PengeluaranBengkel.metode_bayar == PaymentMethod.KREDIT,
                    PengeluaranBengkel.tanggal <= tanggal_sampai
                ).scalar() or 0
                
                # Sum of all payments to those expenses (via KasBank with source PENGELUARAN)
                # Note: this is a simplification, but works if we assume KREDIT expenses stay open until paid via KasBank
                paid_accrued = self.db.query(func.sum(KasBank.nominal)).filter(
                    KasBank.sumber == KasBankSource.PENGELUARAN,
                    KasBank.tipe == KasBankType.KELUAR,
                    KasBank.tanggal <= tanggal_sampai,
                    # We only count payments that were for previous KREDIT transactions 
                    # (this is hard to distinguish without a direct link, but typically 
                    # manual KasBank entries for debt settlement will have PENGELUARAN source)
                ).scalar() or 0
                
                # Wait, this might be risky. Let's stick to HutangUsaha if the system is designed to use it.
                # Actually, PengeluaranService.create SKIPS KasBank for KREDIT.
                # So if it's KREDIT, it's just a number in the ledger.
                total_accrued = float(nominal_accrued)
            
            return total_hu + total_accrued

        # Debt Position at End date
        hutang_part = get_debt_balance_at_date([HutangSource.PEMBELIAN_PART])
        hutang_mobil = get_debt_balance_at_date([HutangSource.PEMBELIAN_MOBIL, HutangSource.JUAL_BELI_MOBIL])
        hutang_lainnya = get_debt_balance_at_date([HutangSource.LAINNYA])
        hutang_total = hutang_part + hutang_mobil + hutang_lainnya

        # Internal Elimination: Workshop revenue from internal car unit repairs
        internal_elimination = float(self.db.query(func.sum(TransaksiPenjualanBengkel.grand_total)).filter(
            TransaksiPenjualanBengkel.kategori.in_(['jual_beli_mobil', 'mobil', 'penjualan_mobil', 'jasa_angkut', 'bengkel']),
            TransaksiPenjualanBengkel.status_bayar != PaymentStatus.BATAL,
            TransaksiPenjualanBengkel.tanggal >= tanggal_dari,
            TransaksiPenjualanBengkel.tanggal <= tanggal_sampai
        ).scalar() or 0)

        # Summary of profits for Section A (TPM portion only to match reconciliation)
        laba_mobil_gross = float(mobil_summary.get("total_laba_kotor", 0))
        laba_mobil_tpm = float(mobil_summary.get("laba_tpm", 0))
        laba_bengkel_kotor = float(bengkel_summary.get("total_laba_kotor", 0))
        laba_ja_tpm = float(ja_revenue_tpm)

        total_laba_gross = laba_mobil_tpm + laba_bengkel_kotor + laba_ja_tpm
        total_operasional = (
            bengkel_ops_total + bengkel_common + 
            ja_expenses_trip + ja_tagged_from_wallet + general_ja_overhead + ja_expenses_bengkel +
            general_mobil_overhead - ja_double_exp
        )


        return {
            "periode": {"dari": tanggal_dari, "sampai": tanggal_sampai},
            "retained_earnings": total_laba_gross - internal_elimination - total_operasional,
            "laba_tpm": total_laba_gross - internal_elimination - total_operasional, # Legacy support
            "total_operasional": total_operasional,
            "internal_elimination": internal_elimination,
            "ja_double_exp_adjustment": ja_double_exp,
            "opening_balance": saldo_awal,
            "revenue": {
                "bengkel": float(bengkel_summary["total_penjualan"]),
                "mobil": float(mobil_summary["total_penjualan"]),
                "jasa_angkut": float(muatan_summary["total_pendapatan"]),
                "total": float(bengkel_summary["total_penjualan"] + mobil_summary["total_penjualan"] + muatan_summary["total_pendapatan"])
            },
            "units": {
                "mobil": {
                    "total_laba_kotor": laba_mobil_gross, 
                    "total_laba_tpm": laba_mobil_tpm,
                    "sharing_investor": laba_mobil_gross - laba_mobil_tpm,
                    "purchase_hpp": hpp_sold_price,
                    "prep_hpp": hpp_sold_prep,
                    "stock_purchase_period": total_stock_purchase_period,
                    "purchase_stock_period": total_stock_purchase_period,
                    "purchase_stock_unpaid": purchase_stock_unpaid,
                    "purchase_unsold_period": capital_unsold_purchase,
                    "prep_stock_period": capital_unsold_prep + mobil_total_repairs_unsold,
                    "repairs": mobil_total_repairs_sold,
                    "repairs_total": repairs_total_period,
                    "prep_total": prep_total_period,
                    "overhead": general_mobil_overhead,
                    "total_outflow_wallet": raw_mobil_outflow,
                    "prive": float(mobil_prive_unit)
                },
                "jasa_angkut": {
                    "revenue_tpm": laba_ja_tpm,
                    "repairs": ja_expenses_bengkel,
                    "armada_ops": float(ja_details.get("armada_period_ops", 0)),
                    "armada_ops_ledger": ja_tagged_from_wallet,
                    "trip_costs": ja_expenses_trip,
                    "overhead": general_ja_overhead,
                    "double_exp_adjustment": ja_double_exp,
                    "total_outflow_wallet": raw_ja_outflow,
                    "prive": float(ja_prive_unit)
                },
                "bengkel": {
                    "laba_kotor": laba_bengkel_kotor,
                    "total_hpp": float(bengkel_summary["total_hpp"]),
                    "common_expenses": bengkel_common,
                    "total_expenses": bengkel_ops_total,
                    "gaji": float(gaji_summary["total"]),
                    "total_outflow_wallet": raw_bengkel_outflow,
                    "prive": float(b_prive_unit)
                }
            },
            "operasional": (
                bengkel_ops_total + bengkel_common + 
                float(ja_details.get("armada_period_ops", 0)) + ja_tagged_from_wallet + general_ja_overhead + ja_expenses_bengkel +
                general_mobil_overhead - ja_double_exp
            ),
            "prive_global": prive_total,
            "assets": {
                "tetap": aset_tetap,
                "persediaan_part": part_stock,
                "persediaan_mobil": car_stock
            },
            "raw_summaries": {
                "bengkel": bengkel_summary,
                "pengeluaran": pengeluaran_summary,
                "pembelian_part": pembelian_part_summary,
                "mobil": mobil_summary,
                "muatan": muatan_summary,
                "gaji": gaji_summary,
                "hutang": {
                    "part": hutang_part,
                    "mobil": hutang_mobil,
                    "lainnya": hutang_lainnya,
                    "total": hutang_total,
                },
                "opening_balance": saldo_awal
            }
        }
