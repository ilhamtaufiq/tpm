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

from app.models.bengkel import (
    TransaksiPenjualanBengkel, 
    PengeluaranBengkel, 
    SparePart, 
    DetailPembelianSparePart, 
    PembelianSparePart, 
    DetailTransaksiSpareParts
)
from app.models.mobil import Mobil, TransaksiPenjualanMobil, InvestorDisbursementDetail
from app.models.jasa_angkut import MuatanJasaAngkut, JasaAngkutPartService, ArmadaJasaAngkut
from app.models.keuangan import KasBank, Aset, PiutangUsaha, HutangUsaha, PembayaranPiutang

from app.utils.constants import (
    KasBankSource, 
    KasBankType, 
    KasBankJenis,
    PaymentStatus,
    PiutangStatus,
    ExpenseCategory, 
    OwnershipType,
    CarStatus,
    PaymentMethod,
    PiutangSource,
    InvestorDisbursementStatus
)

class BaseReportService:
    def __init__(self, db: Session):
        self.db = db

    def get_cumulative_profit(self, until_date: date) -> float:
        """Calculate total net profit from inception until until_date (inclusive).
        Uses retained_earnings from get_unit_financial_breakdown which already
        accounts for gaji, lembur, and all operational expenses."""
        if until_date < date(2025, 1, 1):
            return 0.0
            
        # Call period breakdown for the whole historical range
        hist = self.get_unit_financial_breakdown(date(2024, 1, 1), until_date)
        
        # Use the canonical retained_earnings (already includes gaji deduction)
        return float(hist.get("retained_earnings", 0))

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
        
        # 0. JA Double-Count Check
        # (Where an expense is recorded in both MuatanForm AND manual KasBank)
        # Note: we used to subtract this, but it turns out MuatanService automatic entries 
        # are only in KasBank and JasaAngkutBiayaLainnya, not in PengeluaranBengkel (ledger).
        # So subtraction from ledger-based totals is incorrect.
        ja_double_exp = 0

        
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
            ~KasBank.keterangan.ilike("%Pencairan Investor%"),
            or_(
                KasBank.keterangan.ilike("Pencairan %"),
                KasBank.keterangan.ilike("Prive %"),
                KasBank.keterangan.ilike("%pembagian laba%")
            ),
            KasBank.tanggal >= tanggal_dari,
            KasBank.tanggal <= tanggal_sampai
        ).scalar() or 0)
        
        prive_total = max(prive_total_ledger, prive_unrecorded)

        # 7. Untracked Bank/Admin fees and other small outflows that didn't hit the ledger
        # This helps resolve small discrepancies like the reported -30,380
        # NOTE: We exclude piutang/kasbon transactions (e.g. "[Bengkel] Pemberian piutang 
        # kepada Admin") because those are asset conversions (cash → receivable), not expenses.
        # Also exclude unit wallet sources (BENGKEL, JASA_ANGKUT) since those are internal ops.
        admin_fees_unrecorded = float(self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.tipe == KasBankType.KELUAR,
            KasBank.tanggal >= tanggal_dari,
            KasBank.tanggal <= tanggal_sampai,
            ~KasBank.keterangan.ilike("%piutang%"),
            ~KasBank.keterangan.ilike("%kasbon%"),
            ~KasBank.sumber.in_([KasBankSource.BENGKEL, KasBankSource.JASA_ANGKUT, KasBankSource.JUAL_BELI_MOBIL]),
            or_(
                KasBank.keterangan.ilike("%biaya admin%"),
                KasBank.keterangan.ilike("%biaya transfer%"),
                KasBank.keterangan.ilike("%pajak bank%"),
                KasBank.keterangan.ilike("%fee%"),
                KasBank.keterangan.ilike("%biaya m-banking%")
            )
        ).scalar() or 0)

        mobil_entity_total = (
            float(pengeluaran_summary["per_unit"].get("mobil", 0)) + 
            float(pengeluaran_summary["per_unit"].get("jual_beli_mobil", 0)) + 
            float(pengeluaran_summary["per_unit"].get("penjualan_mobil", 0))
        )
        ja_entity_total = float(pengeluaran_summary["per_unit"].get("jasa_angkut", 0))

        # Detect gap between physical Jasa Angkut outflow and tracked ledger/trip costs
        # This catches service payments recorded in KasBank but missed in reports
        ja_untracked_gap = 0
        if ja_wallet_out > (ja_entity_total + ja_expenses_trip):
            ja_untracked_gap = ja_wallet_out - (ja_entity_total + ja_expenses_trip)
        
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
        # Keep consistent with spare part stock valuation rules:
        # - "Always Ready" items use stok=999 sentinel → modal = 0 (catalog only, no physical stock).
        # - Normal items are valued as stok * harga_beli.
        # - Ignore soft-deleted rows.
        # 6. Spare Part Inventory Value (Point-in-Time)
        # Formula: Current Stock Value - (Value of Purchases > Date) + (Value of Sales/Usage > Date)
        current_stock_val = float(self.db.query(
            func.sum(
                case(
                    (SparePart.stok == 999, 0),
                    else_=SparePart.stok * SparePart.harga_beli
                )
            )
        ).filter(SparePart.deleted_at.is_(None)).scalar() or 0)
        
        purchases_after = float(self.db.query(func.sum(DetailPembelianSparePart.subtotal)).join(PembelianSparePart).filter(
            PembelianSparePart.tanggal > tanggal_sampai
        ).scalar() or 0)
        
        usage_after = float(self.db.query(func.sum(DetailTransaksiSpareParts.qty * DetailTransaksiSpareParts.harga_beli)).join(TransaksiPenjualanBengkel).filter(
            TransaksiPenjualanBengkel.tanggal > tanggal_sampai
        ).scalar() or 0)
        
        part_stock = current_stock_val - purchases_after + usage_after
        # Car Stock (Available as of date: masuk <= sampai AND (keluar is null OR keluar > sampai))
        # Total Capitalized Value = Purchase Price + Prep + Repairs for unsold cars
        car_stock = float(self.db.query(func.sum(Mobil.harga_beli)).filter(
            Mobil.tanggal_masuk <= tanggal_sampai,
            or_(Mobil.tanggal_terjual.is_(None), Mobil.tanggal_terjual > tanggal_sampai),
            Mobil.deleted_at.is_(None)
        ).scalar() or 0)
        
        # Cumulative improvement costs for currently unsold cars (Snapshot as of tanggal_sampai)
        # This ensures inventory valuation remains consistent even if we filter for a single day in the future.
        unsold_car_ids = [m.id for m in self.db.query(Mobil.id).filter(
            Mobil.tanggal_masuk <= tanggal_sampai,
            or_(Mobil.tanggal_terjual.is_(None), Mobil.tanggal_terjual > tanggal_sampai),
            Mobil.deleted_at.is_(None)
        ).all()]
        
        snapshot_unsold_prep = float(self.db.query(func.sum(PengeluaranBengkel.jumlah)).filter(
            PengeluaranBengkel.mobil_id.in_(unsold_car_ids),
            PengeluaranBengkel.kategori == ExpenseCategory.BIAYA_LAINNYA,
            PengeluaranBengkel.tanggal <= tanggal_sampai
        ).scalar() or 0)
        
        snapshot_unsold_repairs_ext = float(self.db.query(func.sum(PengeluaranBengkel.jumlah)).filter(
            PengeluaranBengkel.mobil_id.in_(unsold_car_ids),
            PengeluaranBengkel.kategori == ExpenseCategory.BIAYA_OPERASIONAL,
            PengeluaranBengkel.tanggal <= tanggal_sampai
        ).scalar() or 0)

        # Internal Workshop Bills (Cumulative for unsold)
        # We query TransaksiPenjualanBengkel directly for internal bills tagged to unsold cars
        snapshot_unsold_repairs_int = float(self.db.query(func.sum(TransaksiPenjualanBengkel.grand_total)).filter(
            TransaksiPenjualanBengkel.mobil_id.in_(unsold_car_ids),
            TransaksiPenjualanBengkel.status_bayar != PaymentStatus.BATAL,
            TransaksiPenjualanBengkel.tanggal <= tanggal_sampai
        ).scalar() or 0)

        car_stock += (snapshot_unsold_prep + snapshot_unsold_repairs_ext + snapshot_unsold_repairs_int)
        
        aset_persediaan = part_stock + car_stock

        # Piutang (Cumulative as of end date)
        # We include internal receivables from Jual Beli Mobil units as they represent 
        # inventory value conversion (Workshop bill added to Car asset value).
        # We exclude other internal receivables (e.g. Jasa Angkut repairs) to avoid 
        # counting internal expenses as consolidated assets.
        # Piutang (Cumulative as of end date)
        # We calculate the balance as of the cutoff date: sum(nominal) - sum(payments_up_to_date)
        # We include internal receivables from Jual Beli Mobil units as they represent 
        # inventory value conversion (Workshop bill added to Car asset value).
        # We also include internal Kasbon (Staff Advances) as they represent assets.
        
        # 1. Total Nominal
        total_nominal_piutang = float(self.db.query(func.sum(PiutangUsaha.nominal_piutang)).filter(
            PiutangUsaha.tanggal <= tanggal_sampai,
            or_(
                PiutangUsaha.is_internal != True,
                PiutangUsaha.sumber.in_([PiutangSource.JUAL_BELI_MOBIL, PiutangSource.KASBON_KARYAWAN])
            ),
            PiutangUsaha.status != PiutangStatus.BATAL
        ).scalar() or 0)
        
        # 2. Total Payments as of Cutoff
        total_piutang_paid = float(self.db.query(func.sum(PembayaranPiutang.nominal)).join(PiutangUsaha).filter(
            PiutangUsaha.tanggal <= tanggal_sampai,
            or_(
                PiutangUsaha.is_internal != True,
                PiutangUsaha.sumber.in_([PiutangSource.JUAL_BELI_MOBIL, PiutangSource.KASBON_KARYAWAN])
            ),
            PiutangUsaha.status != PiutangStatus.BATAL,
            PembayaranPiutang.tanggal <= tanggal_sampai
        ).scalar() or 0)
        
        piutang_usaha = total_nominal_piutang - total_piutang_paid
             # Debt Position at End date
        def get_debt_balance_by_unit(source_list: list, unit: Optional[KasBankSource] = None) -> float:
            nominal_q = self.db.query(func.sum(HutangUsaha.nominal_hutang)).filter(
                HutangUsaha.sumber.in_(source_list),
                HutangUsaha.is_internal != True,
                HutangUsaha.tanggal <= tanggal_sampai
            )
            if unit:
                nominal_q = nominal_q.filter(HutangUsaha.unit == unit)
            
            nominal = nominal_q.scalar() or 0
            
            paid_q = self.db.query(func.sum(PembayaranHutang.nominal)).join(HutangUsaha).filter(
                HutangUsaha.sumber.in_(source_list),
                PembayaranHutang.tanggal <= tanggal_sampai
            )
            if unit:
                paid_q = paid_q.filter(HutangUsaha.unit == unit)
                
            paid = paid_q.scalar() or 0
            
            return float(nominal - paid)

        hutang_part = get_debt_balance_by_unit([HutangSource.PEMBELIAN_PART])
        hutang_mobil = get_debt_balance_by_unit([HutangSource.PEMBELIAN_MOBIL, HutangSource.JUAL_BELI_MOBIL])
        # Hutang Jasa Angkut (usually captured via unit filter on LAINNYA if not specified otherwise)
        hutang_ja = get_debt_balance_by_unit([HutangSource.LAINNYA], unit=KasBankSource.JASA_ANGKUT)
        
        # Hutang Investor (Unpaid capital + profit share)
        # 1. Capital from cars not yet sold (or sold after period end)
        unsold_investor_capital = float(self.db.query(func.sum(Mobil.nominal_investor)).filter(
            Mobil.tipe_kepemilikan == OwnershipType.INVESTOR,
            Mobil.tanggal_masuk <= tanggal_sampai,
            or_(
                Mobil.status != CarStatus.TERJUAL,
                Mobil.tanggal_terjual > tanggal_sampai
            )
        ).scalar() or 0)

        # 2. Capital + Profit from cars sold within/before period
        investor_debt = float(self.db.query(func.sum(Mobil.nominal_investor + TransaksiPenjualanMobil.laba_investor)).select_from(TransaksiPenjualanMobil).join(Mobil, TransaksiPenjualanMobil.mobil_id == Mobil.id).filter(
            TransaksiPenjualanMobil.tanggal <= tanggal_sampai
        ).scalar() or 0)
        investor_paid = float(self.db.query(func.sum(InvestorDisbursementDetail.nominal)).join(TransaksiPenjualanMobil).filter(
            InvestorDisbursementDetail.tanggal <= tanggal_sampai
        ).scalar() or 0)
        
        hutang_investor = unsold_investor_capital + max(0, investor_debt - investor_paid)

        hutang_lainnya = get_debt_balance_by_unit([HutangSource.LAINNYA]) - hutang_ja
        
        # Add accrued expenses from ledger (KREDIT) to hutang lainnya
        # Sum of all KREDIT expenses
        nominal_accrued = float(self.db.query(func.sum(PengeluaranBengkel.jumlah)).filter(
            PengeluaranBengkel.metode_bayar == PaymentMethod.KREDIT,
            PengeluaranBengkel.tanggal <= tanggal_sampai
        ).scalar() or 0)
        # Note: we assume accrued items are mostly 'lainnya' until categorized in HutangUsaha
        hutang_lainnya += nominal_accrued

        hutang_total = hutang_part + hutang_mobil + hutang_ja + hutang_investor + hutang_lainnya

        # Piutang Breakdown
        def get_piutang_balance(unit: Optional[KasBankSource] = None, source: Optional[PiutangSource] = None, include_internal: bool = False, unit_in: Optional[List[KasBankSource]] = None) -> float:
            # Point-in-time balance: sum(nominal) - sum(payments_as_of_cutoff)
            
            # Base query for nominal
            q_nom = self.db.query(func.sum(PiutangUsaha.nominal_piutang)).filter(
                PiutangUsaha.tanggal <= tanggal_sampai,
                PiutangUsaha.status != PiutangStatus.BATAL
            )
            
            # Base query for payments
            q_paid = self.db.query(func.sum(PembayaranPiutang.nominal)).join(PiutangUsaha).filter(
                PiutangUsaha.tanggal <= tanggal_sampai,
                PiutangUsaha.status != PiutangStatus.BATAL,
                PembayaranPiutang.tanggal <= tanggal_sampai
            )

            if not include_internal:
                # Strictly external
                q_nom = q_nom.filter(PiutangUsaha.is_internal != True)
                q_paid = q_paid.filter(PiutangUsaha.is_internal != True)
            else:
                # include_internal=True means we allow internal IF it is JB_MOBIL or KASBON
                # (matching the global piutang_usaha logic)
                internal_filter = or_(
                    PiutangUsaha.is_internal != True,
                    PiutangUsaha.sumber.in_([PiutangSource.JUAL_BELI_MOBIL, PiutangSource.KASBON_KARYAWAN])
                )
                q_nom = q_nom.filter(internal_filter)
                q_paid = q_paid.filter(internal_filter)
                
            if unit:
                q_nom = q_nom.filter(PiutangUsaha.unit == unit)
                q_paid = q_paid.filter(PiutangUsaha.unit == unit)

            if unit_in:
                q_nom = q_nom.filter(PiutangUsaha.unit.in_(unit_in))
                q_paid = q_paid.filter(PiutangUsaha.unit.in_(unit_in))
                
            if source:
                q_nom = q_nom.filter(PiutangUsaha.sumber == source)
                q_paid = q_paid.filter(PiutangUsaha.sumber == source)
                
            nominal = q_nom.scalar() or 0
            paid = q_paid.scalar() or 0
            return float(nominal - paid)

        # Piutang Bengkel Breakdown: External vs Internal
        piutang_bengkel_ext = get_piutang_balance(unit=KasBankSource.BENGKEL, source=PiutangSource.BENGKEL, include_internal=False)
        
        # Internal Workshop Bills (Internal Repair for units)
        q_bengkel_int_nom = self.db.query(func.sum(PiutangUsaha.nominal_piutang)).filter(
            PiutangUsaha.unit == KasBankSource.BENGKEL,
            PiutangUsaha.is_internal == True,
            PiutangUsaha.sumber == PiutangSource.JUAL_BELI_MOBIL,
            PiutangUsaha.tanggal <= tanggal_sampai,
            PiutangUsaha.status != PiutangStatus.BATAL
        )
        q_bengkel_int_paid = self.db.query(func.sum(PembayaranPiutang.nominal)).join(PiutangUsaha).filter(
            PiutangUsaha.unit == KasBankSource.BENGKEL,
            PiutangUsaha.is_internal == True,
            PiutangUsaha.sumber == PiutangSource.JUAL_BELI_MOBIL,
            PiutangUsaha.tanggal <= tanggal_sampai,
            PiutangUsaha.status != PiutangStatus.BATAL,
            PembayaranPiutang.tanggal <= tanggal_sampai
        )
        piutang_bengkel_int = float((q_bengkel_int_nom.scalar() or 0) - (q_bengkel_int_paid.scalar() or 0))
        
        piutang_ja = get_piutang_balance(unit=KasBankSource.JASA_ANGKUT, source=PiutangSource.JASA_ANGKUT, include_internal=False)
        piutang_mobil = get_piutang_balance(unit=KasBankSource.JUAL_BELI_MOBIL, source=PiutangSource.JUAL_BELI_MOBIL, include_internal=False)
        
        # Kasbon Breakdown: Only specific units go to 'Piutang Kasbon', the rest ('Umum') goes to 'Lainnya'
        piutang_kasbon = get_piutang_balance(
            source=PiutangSource.KASBON_KARYAWAN, 
            include_internal=True,
            unit_in=[KasBankSource.BENGKEL, KasBankSource.JASA_ANGKUT, KasBankSource.JUAL_BELI_MOBIL]
        )
        piutang_lainnya = piutang_usaha - (piutang_bengkel_ext + piutang_bengkel_int + piutang_ja + piutang_mobil + piutang_kasbon)

        # Internal Elimination: Workshop revenue from internal car unit repairs
        # We eliminate the FULL revenue. Since the income is Revenue - HPP,
        # eliminating the Full Revenue leaves us with -HPP, which is the correct
        # net effect for consolidated equity (the loss of inventory value).
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
        
        # Gaji total (salary) — must be included as expense for retained_earnings
        gaji_pokok = float(gaji_summary.get("total_gaji_pokok", 0))
        gaji_lembur = float(gaji_summary.get("total_uang_lembur", 0))
        
        # Investor sharing (already net in laba_mobil_tpm, so NOT double-subtracted)
        investor_sharing = laba_mobil_gross - laba_mobil_tpm
        
        # Include ja_expenses_bengkel here.
        # Internal workshop repairs (JA -> Bengkel) are revenue for Bengkel, 
        # so they MUST be an expense for JA to balance the consolidated report.
        total_operasional = (
            bengkel_ops_total + bengkel_common + 
            ja_expenses_trip + ja_expenses_bengkel + ja_tagged_from_wallet + general_ja_overhead +
            general_mobil_overhead + 
            admin_fees_unrecorded + ja_untracked_gap
        )
        
        # ═══════════════════════════════════════════════════════════════
        # RETAINED EARNINGS: Must exactly match LabaRugiService formula
        # LabaRugi: laba_operasional = (b_net + ja_net + m_net) - overhead
        # LabaRugi: laba_bersih = laba_operasional - prive
        # 
        # Here we compute laba_operasional (before prive) to store as
        # retained_earnings. Neraca will subtract prive separately.
        # 
        # Formula: gross_profit - gaji - ops - overhead = laba_operasional
        # This is equivalent to sum of unit net profits - central overhead.
        # ═══════════════════════════════════════════════════════════════
        # Internal Elimination Breakdown:
        # We must eliminate the internal revenue, but keep the HPP as an expense
        # because the physical stock is actually gone.
        # So, Retained Earnings should be reduced by the HPP of internal transactions.
        
        retained_earnings = (
            total_laba_gross 
            - total_operasional 
            - gaji_pokok
            - gaji_lembur
        )
        
        # laba_bersih = retained_earnings - prive (matches Laba Rugi final line)
        laba_bersih = retained_earnings - prive_total


        return {
            "periode": {"dari": tanggal_dari, "sampai": tanggal_sampai},
            "retained_earnings": retained_earnings,
            "laba_bersih": laba_bersih,
            "laba_tpm": retained_earnings, # Legacy support
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
                    "gaji": gaji_pokok,
                    "lembur": gaji_lembur,
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
            "admin_fees_unrecorded": admin_fees_unrecorded,
            "ja_untracked_gap": ja_untracked_gap,
            "assets": {
                "tetap": aset_tetap,
                "persediaan_part": part_stock,
                "persediaan_mobil": {
                    "total": car_stock,
                    "harga_beli": car_stock - (snapshot_unsold_prep + snapshot_unsold_repairs_ext + snapshot_unsold_repairs_int),
                    "biaya_persiapan": snapshot_unsold_prep,
                    "perbaikan_external": snapshot_unsold_repairs_ext,
                    "perbaikan_internal": snapshot_unsold_repairs_int
                },
                "persediaan_mobil_internal_component": snapshot_unsold_repairs_int
            },
            "raw_summaries": {
                "bengkel": bengkel_summary,
                "pengeluaran": pengeluaran_summary,
                "pembelian_part": pembelian_part_summary,
                "mobil": mobil_summary,
                "muatan": muatan_summary,
                "gaji": gaji_summary,
                "hutang": {
                    "total": hutang_total,
                    "breakdown": {
                        "bengkel": hutang_part,
                        "ja": hutang_ja,
                        "mobil": hutang_mobil,
                        "investor": hutang_investor,
                        "lainnya": hutang_lainnya
                    }
                },
                "piutang": {
                    "total": piutang_usaha,
                    "breakdown": {
                        "bengkel": piutang_bengkel_ext + piutang_bengkel_int,
                        "bengkel_internal": piutang_bengkel_int,
                        "ja": piutang_ja,
                        "mobil": piutang_mobil,
                        "kasbon": piutang_kasbon,
                        "lainnya": piutang_lainnya
                    }
                },
                "opening_balance": saldo_awal,
                "internal_elimination": internal_elimination
            }
        }
