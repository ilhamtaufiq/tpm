from app.utils.constants import CarStatus
from datetime import date
from typing import Dict, Any
from sqlalchemy import func, or_
from app.services.reports.base import BaseReportService
from app.models.keuangan import KasBank, HutangUsaha, PiutangUsaha
from app.models.mobil import Mobil, TransaksiPenjualanMobil
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

        # Modal Masuk (Setoran)
        setoran_modal = float(self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.sumber == KasBankSource.MODAL,
            KasBank.tipe == KasBankType.MASUK,
            KasBank.tanggal >= tanggal_dari,
            KasBank.tanggal <= tanggal_sampai
        ).scalar() or 0)

        # Calculate GROSS Profit for Section A (Display consistency: 1M row = 1M total)
        laba_bengkel = float(b.get("laba_kotor", 0))
        laba_mobil_gross = float(m.get("total_laba_kotor", 0))
        laba_ja = float(ja.get("revenue_gross", 0)) or float(ja.get("revenue_tpm", 0))
        
        # Sharing investor is moved to Section C (Operational Expense) 
        # to prevent double counting since it is also in Section E (Liabilities)
        sharing_investor_accrual = float(m.get("sharing_investor", 0))

        total_laba = laba_bengkel + laba_mobil_gross + laba_ja

        # Snapshot inventory/fixed assets that represent capital tied in non-cash assets.
        # These values are also shown in Section A breakdown and must be capitalized
        # so Section B (which lists the same assets as non-cash components) does not
        # create artificial negative theoretical modal.
        persediaan_part = float(data["assets"].get("persediaan_part", 0))
        persediaan_mobil = float(data["assets"].get("persediaan_mobil", 0))
        aset_tetap = float(data["assets"].get("tetap", 0))
        
        # Section A should represent Total Capital Position (Base + Period Additions)
        # We must include the liquid opening balance to reconcile points-in-time correctly.
        total_a = (
            data.get("opening_balance", 0) +  # Liquid cash at start
            setoran_modal +                   # New cash injected
            total_laba +                      # TPM's earned share
            persediaan_part +                 # Capital in spare part inventory
            persediaan_mobil +                # Capital in car inventory
            aset_tetap                        # Capital in fixed assets
        )

        # Section B: Piutang & Aset — query from PiutangUsaha table partitioned by source
        def _piutang_saldo(*sumber_list) -> float:
            """Sum sisa_piutang for given sources that are not fully paid.
            Excludes internal unit-to-unit receivables to maintain global report balance.
            """
            query = self.db.query(func.sum(PiutangUsaha.sisa_piutang)).filter(
                PiutangUsaha.sumber.in_(sumber_list),
                PiutangUsaha.status != PiutangStatus.LUNAS,
                ~PiutangUsaha.nama_debitur.ilike("%MOBIL%"),
                ~PiutangUsaha.nama_debitur.ilike("%UNIT%")
            )
            return float(query.scalar() or 0)

        section_b = {
            "piutang_usaha": _piutang_saldo(PiutangSource.BENGKEL),
            "piutang_mobil": _piutang_saldo(PiutangSource.JUAL_BELI_MOBIL), # Credit sales to customers
            # Internal repair receivables must be 0 in this report because they are 
            # capitalized in the car's HPP value.
            "piutang_part_mobil": 0, 
            "piutang_jasa_angkut": _piutang_saldo(PiutangSource.JASA_ANGKUT),
            "piutang_karyawan": _piutang_saldo(PiutangSource.KASBON_KARYAWAN),
            "piutang_lainnya": _piutang_saldo(PiutangSource.LAINNYA),
            "stok_part": data["assets"]["persediaan_part"],
            "stok_mobil": data["assets"]["persediaan_mobil"],
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
                ja["armada_ops"] + ja["armada_ops_ledger"] + ja["overhead"] + ja["repairs"] +
                m["overhead"]
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
            "prive": data["raw_summaries"]["pengeluaran"]["per_kategori"].get("prive", {}).get("total", 0),
            "kasbon_karyawan": data["raw_summaries"]["pengeluaran"]["per_kategori"].get("kasbon", {}).get("total", 0) or data["raw_summaries"]["pengeluaran"]["per_kategori"].get("kasbon_karyawan", {}).get("total", 0),
            "total_c": 0
        }
        
        section_c["total_c"] = (
            # section_c["pembelian_part"]["total"] +  <-- Excluded
            # section_c["pembelian_mobil"]["total"] + <-- Excluded
            section_c["pengembalian_investor"]["total"] + 
            section_c["operasional"] + 
            section_c["gaji"] + 
            section_c["lembur"] + 
            section_c["prive"] + 
            section_c["kasbon_karyawan"]
        )

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
                "hpp_bengkel": float(b.get("total_hpp", 0)),
                "hpp_mobil": float(m.get("purchase_hpp", 0) + m.get("prep_hpp", 0)),
                "persediaan_part": persediaan_part,
                "persediaan_mobil": persediaan_mobil,
                "aset_tetap": aset_tetap,
                "total_laba": total_laba,
                "total_a": total_a,
                "details": {
                    "laba_bengkel": laba_bengkel,
                    "hpp_bengkel": b["total_hpp"],
                    "laba_kotor_mobil": float(m.get("total_laba_kotor", 0)),
                    "hpp_mobil": m["purchase_hpp"] + m["prep_hpp"],
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

