from datetime import date
from typing import Dict, Any
from sqlalchemy import func
from app.services.reports.base import BaseReportService
from app.models.keuangan import KasBank, HutangUsaha, PiutangUsaha
from app.utils.constants import (
    KasBankSource, 
    KasBankType, 
    KasBankJenis,
    PiutangStatus,
    PiutangSource,
    HutangStatus
)
class ModalService(BaseReportService):
    def get_report(self, tanggal_dari: date, tanggal_sampai: date) -> Dict[str, Any]:
        """Laporan Perubahan Modal (Capital Change) - Extended structure for Frontend"""
        data = self.get_unit_financial_breakdown(tanggal_dari, tanggal_sampai)
        
        m = data["units"]["mobil"]
        ja = data["units"]["jasa_angkut"]
        b = data["units"]["bengkel"]

        # Modal Masuk (Setoran)
        setoran_modal = float(self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.sumber == KasBankSource.MODAL,
            KasBank.tipe == KasBankType.MASUK,
            KasBank.tanggal >= tanggal_dari,
            KasBank.tanggal <= tanggal_sampai
        ).scalar() or 0)

        # Calculate GROSS Profit for Section A (COGS Purchase only, Prep/Repairs in Section C)
        laba_bengkel = b["laba_kotor"]
        laba_mobil = data["revenue"]["mobil"] - m["purchase_hpp"]
        laba_ja = ja["revenue_tpm"]
        total_laba = laba_bengkel + laba_mobil + laba_ja
        
        total_a = setoran_modal + b["total_hpp"] + m["purchase_hpp"] + data["assets"]["persediaan"] + data["assets"]["tetap"] + total_laba

        # Section B: Piutang & Aset — query from PiutangUsaha table partitioned by source
        def _piutang_saldo(*sumber_list) -> float:
            """Sum sisa_piutang for given sources that are not fully paid."""
            return float(
                self.db.query(func.sum(PiutangUsaha.sisa_piutang)).filter(
                    PiutangUsaha.sumber.in_(sumber_list),
                    PiutangUsaha.status != PiutangStatus.LUNAS,
                ).scalar() or 0
            )

        section_b = {
            # Piutang bengkel umum (kategori umum, bukan jual_beli_mobil)
            "piutang_usaha": _piutang_saldo(PiutangSource.BENGKEL),
            "piutang_mobil": 0,  # reserved for future direct mobil sale credit
            # Piutang bengkel yang terkait dengan perbaikan mobil jual beli
            "piutang_part_mobil": _piutang_saldo(PiutangSource.JUAL_BELI_MOBIL),
            "piutang_jasa_angkut": _piutang_saldo(PiutangSource.JASA_ANGKUT),
            "piutang_karyawan": _piutang_saldo(PiutangSource.KASBON_KARYAWAN),
            "piutang_lainnya": _piutang_saldo(PiutangSource.LAINNYA),
            "aset_persediaan": data["assets"]["persediaan"],
            "aset_tetap": data["assets"]["tetap"],
            "total_b": 0
        }
        section_b["total_b"] = sum(v for k, v in section_b.items() if k != "total_b")

        # Section C: Pengurang
        section_c = {
            "pembelian_part": {
                "total": data["raw_summaries"]["pengeluaran"]["per_kategori"].get("pembelian_sparepart", {}).get("total", 0),
                "cash": data["raw_summaries"]["pengeluaran"]["per_kategori"].get("pembelian_sparepart", {}).get("cash", 0),
                "transfer": data["raw_summaries"]["pengeluaran"]["per_kategori"].get("pembelian_sparepart", {}).get("transfer", 0),
            },
            "hpp_mobil": {
                "pembelian": m["purchase_stock_period"],
                "cash": 0,
                "transfer": m["purchase_stock_period"],
            },
            "pengembalian_investor": {
                "total": data["raw_summaries"]["pengeluaran"]["per_kategori"].get("bagi_hasil", {}).get("total", 0),
                "cash": data["raw_summaries"]["pengeluaran"]["per_kategori"].get("bagi_hasil", {}).get("cash", 0),
                "transfer": data["raw_summaries"]["pengeluaran"]["per_kategori"].get("bagi_hasil", {}).get("transfer", 0),
                "accrued": 0
            },
            "operasional": (
                b["total_expenses"] + b["common_expenses"] + 
                ja["armada_ops"] + ja["armada_ops_ledger"] + ja["overhead"] + ja["repairs"] +
                m["overhead"] + m["repairs_total"] + m["prep_total"]
            ),
            "operasional_unit_details": {
                "umum": b["common_expenses"],
                "bengkel": b["total_expenses"],
                "mobil": m["overhead"],
                "jasa_angkut": ja["overhead"],
                "mobil_bengkel": m["repairs_total"],
                "mobil_prep": m["prep_total"],
                "jasa_angkut_bengkel": ja["repairs"] + ja["armada_ops_ledger"],
                "jasa_angkut_detailed_breakdown": self._get_ja_breakdown(
                    data["raw_summaries"]["pengeluaran"].get("jasa_angkut_armada", {}),
                    data["raw_summaries"]["muatan"]
                )
            },
            "gaji": b["gaji"],
            "lembur": float(data["raw_summaries"]["gaji"].get("total_lembur", 0)),
            "prive": data["prive_global"],
            "kasbon_karyawan": data["raw_summaries"]["pengeluaran"]["per_kategori"].get("kasbon", {}).get("total", 0) or data["raw_summaries"]["pengeluaran"]["per_kategori"].get("kasbon_karyawan", {}).get("total", 0),
            "transaksi_lainnya": 0,
            "total_c": 0
        }
        section_c["total_c"] = (
            section_c["pembelian_part"]["total"] + 
            section_c["hpp_mobil"]["pembelian"] + 
            section_c["pengembalian_investor"]["total"] + 
            section_c["operasional"] + 
            section_c["gaji"] + 
            section_c["lembur"] + 
            section_c["prive"] + 
            section_c["kasbon_karyawan"]
        )

        # Section E: Hutang
        section_e = {
            "hutang_part": float(self.db.query(func.sum(HutangUsaha.sisa_hutang)).scalar() or 0),
            "hutang_mobil": 0,
            "hutang_investor": 0,
            "hutang_lainnya": 0,
            "total_e": 0
        }
        section_e["total_e"] = sum(v for k, v in section_e.items() if k != "total_e")

        # Section D: Final Reconciliation
        theoretical_modal = (total_a - section_b["total_b"] - section_c["total_c"] + section_e["total_e"])
        
        # Actual Cash/Bank position
        actual_balances = {}
        total_actual = 0
        for jenis in KasBankJenis:
            last_kb = self.db.query(KasBank.saldo_sesudah).filter(
                KasBank.jenis == jenis,
                KasBank.tanggal <= tanggal_sampai
            ).order_by(KasBank.id.desc()).first()
            val = float(last_kb[0] if last_kb else 0)
            actual_balances[jenis.name] = val
            total_actual += val

        cash_only = sum(v for k, v in actual_balances.items() if any(x in k for x in ["CASH", "KAS_UNIT", "KAS_UTAMA"]))
        transfer_only = sum(v for k, v in actual_balances.items() if "BANK" in k)
        total_d = cash_only + transfer_only

        # Adjustment is the difference between physical cash/bank and theoretical calculation
        penyesuaian = total_d - theoretical_modal

        return {
            "periode": data["periode"],
            "section_a": {
                "setoran_modal": setoran_modal,
                "hpp_bengkel": b["total_hpp"],
                "hpp_mobil": m["purchase_hpp"],
                "total_laba": total_laba,
                "total_a": total_a,
                "aset_persediaan": data["assets"]["persediaan"],
                "aset_tetap": data["assets"]["tetap"],
                "details": {
                    "laba_bengkel": laba_bengkel,
                    "laba_kotor_mobil": laba_mobil,
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
                "modal_komponen": total_a - section_b["total_b"] + section_e["total_e"]
            },
            "section_e": section_e
        }
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

            
        return summary

