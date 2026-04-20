from datetime import date
from typing import Dict, Any
from app.services.reports.base import BaseReportService

class LabaRugiService(BaseReportService):
    def get_report(self, tanggal_dari: date, tanggal_sampai: date) -> Dict[str, Any]:
        """Laporan Laba Rugi (Profit and Loss)"""
        data = self.get_unit_financial_breakdown(tanggal_dari, tanggal_sampai)
        
        m = data["units"]["mobil"]
        ja = data["units"]["jasa_angkut"]
        b = data["units"]["bengkel"]

        # 1. BENGKEL
        b_revenue = data["raw_summaries"]["bengkel"]["total_penjualan"]
        b_hpp = data["raw_summaries"]["bengkel"]["total_hpp"]
        b_laba_kotor = data["raw_summaries"]["bengkel"]["total_laba_kotor"]
        b_gaji = b["gaji"]
        b_ops = b["total_expenses"] # Wallet-based
        # Unit specific pure profit
        b_laba_bersih = b_laba_kotor - b_gaji - b_ops

        # 2. JASA ANGKUT
        ja_revenue = ja["revenue_tpm"]
        ja_maintenance = ja["repairs"]
        ja_ops = ja["armada_ops"]
        ja_overhead = ja["overhead"]
        ja_laba_bersih = ja_revenue - ja_maintenance - ja_ops - ja_overhead

        # 3. MOBIL
        m_revenue = data["revenue"]["mobil"]
        # Use total stock purchase expenditure for the period (Cash-based approach)
        m_hpp_unit = m["stock_purchase_period"] 
        m_maintenance = m["repairs_total"] # Total repairs in period (matching JA logic)
        m_prep = m["prep_total"] # Total preparation costs in period
        m_overhead = m["overhead"] # Unit general overhead

        m_laba_bersih = m_revenue - m_hpp_unit - m_prep - m_maintenance - m_overhead

        # 4. SUMMARY
        overhead_pusat = b["common_expenses"]
        prive = data["prive_global"]
        # Operating Profit = Sum of units - shared overhead
        total_laba_operasional = b_laba_bersih + ja_laba_bersih + m_laba_bersih - overhead_pusat
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
                    "beban_operasional": b_ops, 
                    "beban_gaji": b_gaji,
                    "laba_bersih": b_laba_bersih
                },
                "jasa_angkut": {
                    "revenue": ja_revenue,
                    "beban_operasional": ja_ops,
                    "maintenance": ja_maintenance,
                    "beban_umum": ja_overhead,
                    "laba_bersih": ja_laba_bersih
                },
                "mobil": {
                    "revenue": m_revenue,
                    "hpp": m_hpp_unit,
                    "beban_operasional": m_prep,
                    "maintenance": m_maintenance,
                    "beban_umum": m_overhead,
                    "laba_bersih": m_laba_bersih
                }
            },
            "summary": {
                "total_beban_umum": overhead_pusat,
                "prive": prive,
                "laba_operasional": total_laba_operasional,
                "laba_bersih": laba_bersih_akhir
            }
        }


