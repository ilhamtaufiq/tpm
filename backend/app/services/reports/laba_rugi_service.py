from datetime import date
from typing import Dict, Any
from sqlalchemy import func
from app.services.reports.base import BaseReportService
from app.utils.constants import PaymentStatus

class LabaRugiService(BaseReportService):
    def get_report(self, tanggal_dari: date, tanggal_sampai: date) -> Dict[str, Any]:
        """Laporan Laba Rugi (Profit and Loss)"""
        data = self.get_unit_financial_breakdown(tanggal_dari, tanggal_sampai)
        
        m = data["units"]["mobil"]
        ja = data["units"]["jasa_angkut"]
        b = data["units"]["bengkel"]

        # 1. BENGKEL
        internal_jbm_profit = data.get("internal_jbm_unrealized_profit", 0)
        # Ensure revenue from internal bengkel transaksi (kategori jasa_angkut and jual_beli_mobil
        # created from jasa-angkut and mobil modules via bengkel/transaksi) are included in bengkel revenue.
        from app.models.bengkel import TransaksiPenjualanBengkel
        from app.utils.constants import PaymentStatus
        b_revenue_full = float(self.db.query(func.sum(TransaksiPenjualanBengkel.grand_total)).filter(
            TransaksiPenjualanBengkel.grand_total > 0,
            TransaksiPenjualanBengkel.status_bayar != PaymentStatus.BATAL,
            TransaksiPenjualanBengkel.tanggal >= tanggal_dari,
            TransaksiPenjualanBengkel.tanggal <= tanggal_sampai,
        ).scalar() or 0)
        b_revenue = b_revenue_full or data["raw_summaries"]["bengkel"]["total_penjualan"]
        b_hpp = data["raw_summaries"]["bengkel"]["total_hpp"]
        b_laba_kotor = data["units"]["bengkel"]["laba_kotor"]
        b_gaji = b["gaji"]
        b_lembur = b.get("lembur", 0)
        b_ops = b["total_expenses"] # Wallet-based
        # Revaluation reserve realized this period (COGS already uses revalued
        # harga_beli, so this restores true historical-cost profit).
        b_penyesuaian_harga_beli = float(data.get("revaluation", {}).get("released_periode", 0))
        # Unit specific pure profit
        b_laba_bersih = b_laba_kotor + b_penyesuaian_harga_beli - b_gaji - b_lembur - b_ops

        # 2. JASA ANGKUT
        # revenue_tpm = share TPM NET setelah biaya operasional muatan dipotong dari tagihan
        # trip_costs hanya biaya trip yang belum dipotong (kolom legacy BBM/tol, dll.)
        ja_trip_costs = ja.get("trip_costs", 0)
        ja_revenue_net = ja["revenue_tpm"]
        
        ja_maintenance = ja["repairs"]
        # Operational costs: Trip Costs (BBM, Tol) + Manual Ledger Tags
        ja_ops_final = ja_trip_costs + ja.get("armada_ops_ledger", 0)
        
        ja_overhead = ja["overhead"]

        
        # JA Net = TPM Share - Trip Costs - Maintenance - Overhead
        ja_laba_bersih = ja_revenue_net - ja_maintenance - ja_ops_final - ja_overhead

        # 3. MOBIL (Accrual-based to match Modal Report)
        # We only count performance of units SOLD within the period
        m_revenue = float(m.get("sales_revenue", 0))
        m_hpp_unit = float(m.get("purchase_hpp", 0))
        m_maintenance = float(m.get("repairs", 0))
        m_prep = float(data["units"]["mobil"].get("prep_hpp", 0))
        m_overhead = m["overhead"] # Unit general overhead
        m_sharing = m["sharing_investor"] # Investor's share (Accrual from base.py)
        m_pendapatan_lainnya = float(m.get("pendapatan_lainnya", 0))

        # Correct Laba Bersih calculation: Revenue - (Purchase + Prep + Repairs) - Overhead - Sharing
        # Booking cancellation penalties are other income under JB Mobil.
        m_laba_bersih = (
            m_revenue
            - m_hpp_unit
            - m_maintenance
            - m_prep
            - m_overhead
            - m_sharing
            + m_pendapatan_lainnya
        )

        # 4. SUMMARY
        overhead_pusat = b["common_expenses"]
        prive = data["prive_global"]
        # E. Consolidation & Elimination
        # Subtract internal workshop revenue from total profit to avoid double-counting
        # within the company perspective.
        # Total operating profit is the sum of unit net profits
        # Internal Workshop Revenue Elimination (for unsold cars)
        elimination = float(data.get("internal_elimination", 0))
        
        # Total Laba Operasional (Bengkel + Jasa Angkut + Mobil)
        # Internal JB Mobil work is recognized immediately as Bengkel profit.
        # `internal_jbm_profit` is kept as an informational trace only.
        total_laba_operasional = (b_laba_bersih + ja_laba_bersih + m_laba_bersih) - overhead_pusat
        laba_bersih_akhir = total_laba_operasional - prive

        return {
            "periode": data["periode"],
            "bengkel_details": data["raw_summaries"]["bengkel"],
            "jasa_angkut_details": data["raw_summaries"]["muatan"],
            "mobil_details": data["raw_summaries"]["mobil"],
            "units": {
                "bengkel": {
                    "revenue": b_revenue,
                    "hpp": b_hpp,
                    "laba_kotor": b_laba_kotor,
                    "laba_penyesuaian_harga_beli": b_penyesuaian_harga_beli,
                    "beban_operasional": b_ops,
                    "beban_gaji": b_gaji,
                    "beban_lembur": b_lembur,
                    "laba_bersih": b_laba_bersih
                },
                "jasa_angkut": {
                    "revenue": ja_revenue_net,
                    "beban_operasional": ja_ops_final,
                    "maintenance": ja_maintenance,
                    "beban_umum": ja_overhead,
                    "laba_bersih": ja_laba_bersih
                },
                "mobil": {
                    "revenue": m_revenue,
                    "pendapatan_lainnya": m_pendapatan_lainnya,
                    "dana_penalti": m_pendapatan_lainnya,
                    "hpp": m_hpp_unit,
                    "beban_operasional": m_prep,
                    "maintenance": m_maintenance,
                    "beban_umum": m_overhead,
                    "sharing_investor": m_sharing,
                    "laba_bersih": m_laba_bersih
                }
            },
            "summary": {
                "total_beban_umum": overhead_pusat,
                "internal_elimination": elimination,
                "internal_profit_elimination": internal_jbm_profit,
                "prive": prive,
                "laba_operasional": total_laba_operasional,
                "laba_bersih": laba_bersih_akhir
            }
        }
