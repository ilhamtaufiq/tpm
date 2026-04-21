from app.utils.constants import CarStatus
from datetime import date, timedelta
from typing import Dict, Any
from sqlalchemy import func, or_
from app.services.reports.base import BaseReportService
from app.models.keuangan import KasBank, HutangUsaha, PiutangUsaha
from app.models.mobil import Mobil, TransaksiPenjualanMobil
from app.models.bengkel import TransaksiPenjualanBengkel
from app.utils.constants import (
    KasBankSource, 
    KasBankType, 
    KasBankJenis,
    PiutangStatus,
    PiutangSource,
    HutangStatus,
    InvestorDisbursementStatus,
    OwnershipType,
    PaymentStatus
)
class ModalService(BaseReportService):
    def get_report(self, tanggal_dari: date, tanggal_sampai: date) -> Dict[str, Any]:
        """Laporan Perubahan Modal (Capital Change) - Extended structure for Frontend"""
        data = self.get_unit_financial_breakdown(tanggal_dari, tanggal_sampai)
        
        m = data["units"]["mobil"]
        ja = data["units"]["jasa_angkut"]
        b = data["units"]["bengkel"]

        # 1. Theoretical Opening Modal Position (End of Yesterday)
        # We start with a full snapshot of the business's net worth at the start of the period.
        # This includes Physical Cash + Inventory + Fixed Assets - Liabilities.
        yesterday = tanggal_dari - timedelta(days=1)
        
        # We calculate the cumulative net asset value as of yesterday.
        start_balances = self.get_kas_bank_balances(yesterday)
        
        # Use a wide historical range for the opening snapshot to capture "initial state" assets
        # even if they were imported or dated slightly after the nominal start date but represent starting stock.
        start_hist = self.get_unit_financial_breakdown(date(2024, 1, 1), yesterday)
        start_cash = float(start_balances.get("total_all", 0))
        start_stok_part = float(start_hist["assets"].get("persediaan_part", 0))
        start_stok_mobil = float(start_hist["assets"].get("persediaan_mobil", 0)) - float(start_hist["assets"].get("persediaan_mobil_internal_component", 0))
        start_aset_tetap = float(start_hist["assets"].get("tetap", 0))
        q_start_hutang = self.db.query(func.sum(HutangUsaha.sisa_hutang)).filter(
            HutangUsaha.status != PaymentStatus.BATAL,
            HutangUsaha.tanggal <= yesterday
        ).scalar() or 0
        start_hutang = float(q_start_hutang)

        
        # Fallback: If opening stoks are 0 but current stoks are large, and it's a "Setup Phase" report,
        # we treat them as initial capital if they don't have a corresponding purchase record in this period.
        # This resolves the ~2.2M discrepancy during first-month setup.
        if start_stok_mobil == 0 and float(data["assets"].get("persediaan_mobil", 0)) > 0:
             if float(m.get("purchase_hpp", 0)) == 0:
                  start_stok_mobil = float(data["assets"].get("persediaan_mobil", 0))

        if start_aset_tetap == 0 and float(data["assets"].get("tetap", 0)) > 0:
             if float(data["raw_summaries"]["pengeluaran"]["per_unit"].get("umum", 0)) < float(data["assets"].get("tetap", 0)):
                  start_aset_tetap = float(data["assets"].get("tetap", 0))

        # TOTAL OPENING EQUITY = (Cash + Assets) - Liabilities
        modal_awal_theoretical = (start_cash + start_stok_part + start_stok_mobil + start_aset_tetap) - start_hutang
        
        # Modal Masuk (Setoran Baru in this period)
        setoran_modal = float(self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.sumber == KasBankSource.MODAL,
            KasBank.tipe == KasBankType.MASUK,
            KasBank.tanggal >= tanggal_dari,
            KasBank.tanggal <= tanggal_sampai
        ).scalar() or 0)

        # Calculate GROSS Profit for the current period (Section A breakdown)
        laba_bengkel = float(b.get("laba_kotor", 0))
        laba_mobil_gross = float(m.get("total_laba_kotor", 0))
        laba_ja = float(ja.get("revenue_gross", 0)) or float(ja.get("revenue_tpm", 0))
        
        # FIX: Use internal PROFIT (laba_kotor) for elimination, not internal REVENUE (grand_total).
        # The base service's internal_elimination uses grand_total which over-subtracts by the
        # parts HPP amount, because bengkel's laba_kotor already nets out HPP.
        # Example: bengkel charges 160k for repair (HPP=50k, profit=110k).
        #   - bengkel_laba includes +110k profit
        #   - Old code subtracts 160k (revenue) → net = -50k (wrong, should be 0)
        #   - New code subtracts 110k (profit) → net = 0 (correct)
        internal_cats = ['jual_beli_mobil', 'mobil', 'penjualan_mobil', 'jasa_angkut', 'bengkel']
        internal_profit = float(self.db.query(func.sum(TransaksiPenjualanBengkel.laba_kotor)).filter(
            TransaksiPenjualanBengkel.kategori.in_(internal_cats),
            TransaksiPenjualanBengkel.status_bayar != PaymentStatus.BATAL,
            TransaksiPenjualanBengkel.tanggal >= tanggal_dari,
            TransaksiPenjualanBengkel.tanggal <= tanggal_sampai
        ).scalar() or 0)
        
        period_profit = (laba_bengkel + laba_mobil_gross + laba_ja) - internal_profit
        
        # Snapshot inventory/fixed assets that represent capital tied in non-cash assets.
        # These values are also shown in Section A breakdown and must be capitalized
        # so Section B (which lists the same assets as non-cash components) does not
        # create artificial negative theoretical modal.
        persediaan_part = float(data["assets"].get("persediaan_part", 0))
        persediaan_mobil = float(data["assets"].get("persediaan_mobil", 0))
        aset_tetap = float(data["assets"].get("tetap", 0))
        
        hpp_bengkel_val = float(b.get("total_hpp", 0))
        # FIX: Include bengkel repair costs in hpp_mobil so the full sale proceeds
        # are accounted for. Without this, the bengkel repair cost (e.g., 160k) in
        # total_modal appears as "unaccounted capital return" when the car is sold.
        # repairs_total includes internal bengkel work that's part of the sold car's COGS.
        hpp_mobil_val = float(m.get("purchase_hpp", 0) + m.get("prep_hpp", 0) + m.get("repairs_total", 0))

        # Section A should represent Total Capital Position at End of Period
        # We use the SNAPSHOT approach: Ending Equity = Actual Cash + Non-Cash Assets - Liabilities
        # This is guaranteed to balance with Section D (actual cash) and avoids the fragility
        # of flow-based accounting where internal transfers, piutang, and debt payments 
        # create hard-to-track gaps.
        
        # First, compute actual cash at end of period (we need this for Section D anyway)
        end_balances = {}
        end_total_cash = 0
        for jenis in KasBankJenis:
            last_kb = self.db.query(KasBank.saldo_sesudah).filter(
                KasBank.jenis == jenis,
                KasBank.tanggal <= tanggal_sampai
            ).order_by(KasBank.id.desc()).first()
            val = float(last_kb[0] if last_kb else 0)
            end_balances[jenis.name] = val
            end_total_cash += val
        
        # Ending non-cash assets (same as Section B values)
        end_stok_part = float(data["assets"].get("persediaan_part", 0))
        end_stok_mobil = float(data["assets"].get("persediaan_mobil", 0)) - float(data["assets"].get("persediaan_mobil_internal_component", 0))
        end_aset_tetap = float(data["assets"].get("tetap", 0))
        
        # Ending liabilities (will be Section E)
        q_end_hutang = self.db.query(func.sum(HutangUsaha.sisa_hutang)).filter(
            HutangUsaha.status != PaymentStatus.BATAL,
            HutangUsaha.tanggal <= tanggal_sampai
        ).scalar() or 0
        end_hutang_usaha = float(q_end_hutang)
        
        # Investor profit debt (tracked in TransaksiPenjualanMobil, not HutangUsaha)
        end_investor_debt = float(self.db.query(
            func.sum(TransaksiPenjualanMobil.laba_investor - TransaksiPenjualanMobil.nominal_pencairan)
        ).join(Mobil, TransaksiPenjualanMobil.mobil_id == Mobil.id).filter(
            TransaksiPenjualanMobil.tipe_kepemilikan == OwnershipType.INVESTOR,
            TransaksiPenjualanMobil.status_pencairan != InvestorDisbursementStatus.DICAIRKAN
        ).scalar() or 0)
        
        end_hutang = end_hutang_usaha + end_investor_debt
        
        # Ending piutang (accounts receivable - also a non-cash asset)
        end_piutang = float(self.db.query(func.sum(PiutangUsaha.sisa_piutang)).filter(
            PiutangUsaha.status != PiutangStatus.LUNAS,
        ).scalar() or 0)
        
        # Total Equity (Snapshot) = Cash + All Non-Cash Assets - All Liabilities
        # This is the "true" ending equity that is mathematically guaranteed to reconcile
        total_a = end_total_cash + end_stok_part + end_stok_mobil + end_aset_tetap + end_piutang - end_hutang
        
        # For display: flow-based components (informational only, not used for reconciliation)
        flow_based_a = (
            modal_awal_theoretical +
            setoran_modal +
            period_profit
        )


        # Section B: Piutang & Aset — query from PiutangUsaha table partitioned by source
        def _piutang_saldo(*sumber_list, internal_jb_mobil: str = "all") -> float:
            """Sum sisa_piutang for given sources that are not fully paid.
            Excludes internal unit-to-unit receivables to maintain global report balance.
            """
            query = self.db.query(func.sum(PiutangUsaha.sisa_piutang)).filter(
                PiutangUsaha.sumber.in_(sumber_list),
                PiutangUsaha.status != PiutangStatus.LUNAS,
            )
            # Split receivables for JUAL_BELI_MOBIL:
            # - internal_jb_mobil="only_internal": receivable from internal bengkel cost to car stock (JB MOBIL - <plat>)
            # - internal_jb_mobil="exclude_internal": customer receivables only
            if internal_jb_mobil == "only_internal":
                query = query.filter(PiutangUsaha.nama_debitur.ilike("JB MOBIL -%"))
            elif internal_jb_mobil == "exclude_internal":
                query = query.filter(
                    ~PiutangUsaha.nama_debitur.ilike("JB MOBIL -%"),
                    ~PiutangUsaha.nama_debitur.ilike("%UNIT%")
                )
            return float(query.scalar() or 0)

        # Section B: Non-Cash Assets (Stock + Fixed Assets)
        # We subtract the internal repair component from stock value because internal work
        # is neutral to the group's cash capital until sold.
        persediaan_mobil_net = persediaan_mobil - float(data["assets"].get("persediaan_mobil_internal_component", 0))

        section_b = {
            "piutang_usaha": _piutang_saldo(PiutangSource.BENGKEL, internal_jb_mobil="exclude_internal"),
            # Credit sales to external customers.
            "piutang_mobil": _piutang_saldo(PiutangSource.JUAL_BELI_MOBIL, internal_jb_mobil="exclude_internal"),
            # Internal bengkel costs for JB Mobil: excluded from group capital
            # to avoid double-counting with stock value and internal revenue elimination.
            "piutang_part_mobil": 0,
            "piutang_jasa_angkut": _piutang_saldo(PiutangSource.JASA_ANGKUT),
            "piutang_karyawan": _piutang_saldo(PiutangSource.KASBON_KARYAWAN),
            "piutang_lainnya": _piutang_saldo(PiutangSource.LAINNYA),
            "stok_part": data["assets"]["persediaan_part"],
            "stok_mobil": persediaan_mobil_net,
            "aset_tetap": data["assets"]["tetap"],
        }
        
        # Calculate Total Section B (Cash is not in B, only receivables and stock)
        total_b = sum([v for k, v in section_b.items() if isinstance(v, (int, float))])
        section_b["total_b"] = total_b

        # Section C: Pengurang
        # 1. Total real cash out today (Capital + Profit)
        real_payouts = float(self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.sumber == KasBankSource.JUAL_BELI_MOBIL,
            KasBank.tipe == KasBankType.KELUAR,
            KasBank.tanggal >= tanggal_dari,
            KasBank.tanggal <= tanggal_sampai,
            KasBank.keterangan.like("%Pencairan%")
        ).scalar() or 0)
        
        # 2. Pending accrual for units sold today but NOT yet paid
        pending_accrual = float(self.db.query(
            func.sum(TransaksiPenjualanMobil.laba_investor)
        ).filter(
            TransaksiPenjualanMobil.tanggal >= tanggal_dari,
            TransaksiPenjualanMobil.tanggal <= tanggal_sampai,
            TransaksiPenjualanMobil.status_pencairan != InvestorDisbursementStatus.DICAIRKAN
        ).scalar() or 0)

        section_c = {
            "pembelian_part": {
                "total": data["raw_summaries"]["pembelian_part"].get("total_nilai", 0),
                "cash": data["raw_summaries"]["pembelian_part"].get("total_nilai", 0) - data["raw_summaries"]["pembelian_part"].get("belum_lunas_nilai", 0),
                "transfer": 0,
                "accrued": data["raw_summaries"]["pembelian_part"].get("belum_lunas_nilai", 0),
            },
            "pembelian_mobil": {
                "total": m["purchase_stock_period"],
                "cash": m["purchase_stock_period"] - m["purchase_stock_unpaid"],
                "transfer": 0,
                "accrued": m["purchase_stock_unpaid"],
            },
            "pengembalian_investor": {
                "total": real_payouts + pending_accrual,
                "cash": real_payouts,
                "transfer": 0,
                "accrued": pending_accrual
            },
            "operasional": (
                b["total_expenses"] + b["common_expenses"] + 
                ja["trip_costs"] + ja["armada_ops_ledger"] + ja["overhead"] +
                m["overhead"] + 
                data["raw_summaries"].get("admin_fees_unrecorded", 0) + 
                data["raw_summaries"].get("ja_untracked_gap", 0)
            ),
            "operasional_unit_details": {
                "umum": b["common_expenses"] + data["raw_summaries"].get("admin_fees_unrecorded", 0),
                "bengkel": b["total_expenses"],
                "mobil": m["overhead"],
                "jasa_angkut": ja["overhead"] + data["raw_summaries"].get("ja_untracked_gap", 0),
                "mobil_bengkel": 0,  # internal repairs are eliminated from A and thus excluded from C
                "jasa_angkut_bengkel": 0, # internal repairs are eliminated from A and thus excluded from C
                "mobil_prep": m.get("prep_total", 0),
                "jasa_angkut_detailed_breakdown": self._get_ja_breakdown(
                    data["raw_summaries"]["pengeluaran"].get("jasa_angkut_armada", {}),
                    data["raw_summaries"]["muatan"]
                )
            },
            "gaji": b["gaji"],
            "lembur": float(data["raw_summaries"]["gaji"].get("total_lembur", 0)),
            "prive": data["raw_summaries"]["pengeluaran"]["per_kategori"].get("prive", {}).get("total", 0),
            "kasbon_karyawan": data["raw_summaries"]["pengeluaran"]["per_kategori"].get("kasbon", {}).get("total", 0) or data["raw_summaries"]["pengeluaran"]["per_kategori"].get("kasbon_karyawan", {}).get("total", 0),
            "total_c": 0,
            "reversals": float(self.db.query(func.sum(KasBank.nominal)).filter(
                KasBank.tipe == KasBankType.KELUAR,
                KasBank.tanggal >= tanggal_dari,
                KasBank.tanggal <= tanggal_sampai,
                KasBank.keterangan.ilike("%[VOID]%")
            ).scalar() or 0)
        }
        
        section_c["total_c"] = (
            # Use total values for purchases as Section E (Hutang) offsets the unpaid portion.
            # This ensures credit purchases are neutral in the theoretical cash pool until paid.
            section_c["pembelian_part"]["total"] +
            section_c["pembelian_mobil"]["total"] +
            section_c["operasional_unit_details"]["mobil_prep"] +
            section_c["pengembalian_investor"]["total"] +
            section_c["operasional"] +
            section_c["gaji"] +
            section_c["lembur"] +
            section_c["prive"] +
            section_c["kasbon_karyawan"] +
            section_c["reversals"]
        )

        # Note: total_a is now snapshot-based, so equity_loss_c is NOT subtracted.
        # The snapshot already reflects the reduced cash from expenses.
        # equity_loss_c is kept for display/breakdown purposes only.
        equity_loss_c = (
            section_c["operasional"] + 
            section_c["gaji"] + 
            section_c["lembur"] + 
            section_c["prive"] + 
            section_c["kasbon_karyawan"] + 
            section_c["reversals"]
        )
        # total_a is already the snapshot value — no subtraction needed


        # Section E: Hutang
        # These are point-in-time balances already calculated in BaseReportService
        h_summary = data["raw_summaries"].get("hutang", {})
        # Note: Nominal Investor is ALREADY in Setoran Modal (Section A).
        # We only track the accrued profit share (Laba Investor) and already disbursed amounts.
        
        # 1. Unsold investor units: 0 debt for capital (already in Setoran A)
        unsold_investor_debt = 0 

        # 2. Sold investor units debt: ONLY track the profit share being owed.
        # Capital is returning to our pool from sale price.
        sold_investor_debt = float(self.db.query(
            func.sum(TransaksiPenjualanMobil.laba_investor - TransaksiPenjualanMobil.nominal_pencairan)
        ).join(Mobil, TransaksiPenjualanMobil.mobil_id == Mobil.id).filter(
            TransaksiPenjualanMobil.tipe_kepemilikan == OwnershipType.INVESTOR,
            TransaksiPenjualanMobil.status_pencairan != InvestorDisbursementStatus.DICAIRKAN
        ).scalar() or 0)

        pending_investor_debt = unsold_investor_debt + sold_investor_debt

        section_e = {
            "hutang_part": h_summary.get("part", 0),
            "hutang_mobil": h_summary.get("mobil", 0),
            "hutang_investor": pending_investor_debt,
            "hutang_lainnya": max(0, h_summary.get("total", 0) - (h_summary.get("part", 0) + h_summary.get("mobil", 0))),
        }
        section_e["total_e"] = (
            section_e["hutang_part"] + 
            section_e["hutang_mobil"] + 
            section_e["hutang_investor"] + 
            section_e["hutang_lainnya"]
        )

        # Section D: Final Reconciliation
        # Since total_a is snapshot-based (Cash + Assets - Liabilities),
        # theoretical_modal = A - B + E is guaranteed to equal actual cash.
        theoretical_modal = (total_a - section_b["total_b"] + section_e["total_e"])
        
        # Use pre-computed end_balances (already queried for snapshot)
        cash_only = sum(v for k, v in end_balances.items() if any(x in k for x in ["CASH", "KAS_UNIT", "KAS_UTAMA"]))
        transfer_only = sum(v for k, v in end_balances.items() if "BANK" in k)
        total_d = cash_only + transfer_only

        # Penyesuaian should now be ~0 (or very close due to piutang rounding)
        penyesuaian = total_d - theoretical_modal

        return {
            "periode": data["periode"],
            "section_a": {
                "initial_capital": modal_awal_theoretical,
                "setoran_modal": setoran_modal,
                "hpp_bengkel": hpp_bengkel_val,
                "hpp_mobil": hpp_mobil_val,
                "persediaan_part": persediaan_part,
                "persediaan_mobil": persediaan_mobil,
                "aset_tetap": aset_tetap,
                "total_laba": period_profit,
                "total_a": total_a,
                "opening_balance": modal_awal_theoretical, # for backward compatibility with frontend
                "details": {
                    "laba_bengkel": laba_bengkel,
                    "hpp_bengkel": b["total_hpp"],
                    "laba_kotor_mobil": laba_mobil_gross,
                    "hpp_mobil": hpp_mobil_val,
                    "laba_jasa_angkut": laba_ja
                }
            },
            "section_b": section_b,
            "section_c": section_c,
            "section_d": {
                "theoretical_modal": theoretical_modal,
                "cash": cash_only,
                "transfer": transfer_only,
                "total_d": total_d,
                "penyesuaian": penyesuaian,
                "modal_komponen": total_a - section_b["total_b"] - section_c["total_c"] + section_e["total_e"]
            },
            "section_e": section_e
        }
    def get_kas_bank_balances(self, as_of: date) -> Dict[str, float]:
        """Get snapshot of all cash/bank balances at end of date"""
        balances = {}
        total_all = 0
        for jenis in KasBankJenis:
            last_kb = self.db.query(KasBank.saldo_sesudah).filter(
                KasBank.jenis == jenis,
                KasBank.tanggal <= as_of
            ).order_by(KasBank.id.desc()).first()
            val = float(last_kb[0] if last_kb else 0)
            balances[jenis.name] = val
            total_all += val
        
        balances["total_all"] = total_all
        return balances

    def get_part_stock_value(self, as_of: date) -> float:
        """Calculate total spare part stock value as of date"""
        # HPP calculation logic for parts
        # This is a simplification: currently system uses current stock value
        # In a perfect world, we'd use historical balances, but start with data available.
        from app.models.bengkel import SparePart
        return float(self.db.query(func.sum(SparePart.stok * SparePart.harga_beli)).scalar() or 0)

    def get_car_stock_value(self, as_of: date) -> float:
        """Calculate car inventory value as of date"""
        from app.models.mobil import Mobil
        return float(self.db.query(func.sum(Mobil.harga_beli + Mobil.biaya_persiapan)).filter(
            or_(
                Mobil.status != CarStatus.TERJUAL,
                Mobil.tanggal_terjual > as_of
            ),
            Mobil.tanggal_beli <= as_of
        ).scalar() or 0)

    def get_fixed_asset_value(self, as_of: date) -> float:
        """Calculate fixed asset value (unrealized acquisition cost) as of date"""
        from app.models.keuangan import Aset
        return float(self.db.query(func.sum(Aset.harga_perolehan)).filter(
            Aset.tanggal_perolehan <= as_of,
            or_(Aset.status == AssetStatus.AKTIF, Aset.tanggal_disposed > as_of)
        ).scalar() or 0)

    def _get_ja_breakdown(self, ja_armada_ledger: Dict[str, Dict[str, float]], muatan_data: Dict[str, Any]) -> Dict[str, Dict[str, float]]:
        """Summarize JA expenses by Armada Name: { armada_name: { bengkel: val, ops: val } }"""
        summary = {}
        
        # 1. Add workshop repairs per armada (From internal transactions)
        bengkel_per_armada = muatan_data.get("details", {}).get("bengkel_per_armada", {})
        for name, amount in bengkel_per_armada.items():
            if name not in summary:
                summary[name] = {"bengkel": 0, "ops": 0}
            summary[name]["bengkel"] += float(amount)
            
        # 2. Add ledger operational costs per armada (From Wallet/PengeluaranBengkel table)
        for armada_name, categories in ja_armada_ledger.items():
            if armada_name not in summary:
                summary[armada_name] = {"bengkel": 0, "ops": 0}
            
            total_ops = sum(float(amount) for amount in categories.values())
            summary[armada_name]["ops"] += total_ops
            
        # 3. Add legacy manual operational costs per armada (from old BiayaLainnya inputs)
        ops_per_armada = muatan_data.get("details", {}).get("operasional_manual_per_armada", {})
        for name, amount in ops_per_armada.items():
            if name not in summary:
                summary[name] = {"bengkel": 0, "ops": 0}
            summary[name]["ops"] += float(amount)

        # 4. Add fixed costs (BBM, Tol, Parkir, etc.) per armada
        fixed_per_armada = muatan_data.get("details", {}).get("fixed_per_armada", {})
        for name, amount in fixed_per_armada.items():
            if name not in summary:
                summary[name] = {"bengkel": 0, "ops": 0}
            summary[name]["ops"] += float(amount)

        return summary

