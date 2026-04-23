from datetime import date
from decimal import Decimal
from typing import Dict, Any
from sqlalchemy import func, or_
from app.services.reports.base import BaseReportService
from app.models.keuangan import KasBank, PiutangUsaha, HutangUsaha, Aset

from app.utils.constants import (
    KasBankJenis, 
    PiutangStatus, 
    HutangStatus, 
    CarStatus, 
    AssetStatus,
    PiutangSource,
    HutangSource,
    KasBankSource,
    KasBankType
)

class NeracaService(BaseReportService):
    def get_report(self, as_of_date: date) -> Dict[str, Any]:
        """Laporan Neraca (Balance Sheet) as of a specific date."""
        from app.models.mobil import TransaksiPenjualanMobil, Mobil
        from app.models.bengkel import SparePart
        from app.utils.constants import InvestorDisbursementStatus, OwnershipType
        
        # 1. ASSETS
        
        # We use BaseReportService for consistent consolidated financial logic
        first_ever = date(2024, 1, 1) # System start date
        hist = self.get_unit_financial_breakdown(first_ever, as_of_date)
        
        # Cash & Bank Balances (Latest balance as of as_of_date)
        balances = {}
        for jenis in KasBankJenis:
            last_kb = self.db.query(KasBank).filter(
                KasBank.jenis == jenis,
                KasBank.tanggal <= as_of_date
            ).order_by(KasBank.id.desc()).first()
            balances[jenis.name] = float(last_kb.saldo_sesudah if last_kb else 0)
        
        # Categorize balances for report breakdown
        kas_tunai = 0
        kas_bank = 0
        unit_cash = 0
        unit_details = {}
        
        for name, value in balances.items():
            if name in ["KAS_UTAMA", "CASH"]:
                kas_tunai += value
            elif "BANK" in name:
                kas_bank += value
            elif "KAS_UNIT" in name:
                unit_cash += value
                unit_details[name.lower()] = value
            else:
                # Fallback for any other custom types
                if name.startswith("KAS"):
                    kas_tunai += value
                else:
                    kas_bank += value
        
        total_cash = sum(balances.values())

        # Piutang breakdown - Use values from hist for consistency
        raw_hutang = hist.get("raw_summaries", {}).get("hutang", {})
        
        # Assets from consolidated breakdown
        total_stock_mobil = hist["assets"]["persediaan_mobil"]
        total_stock_parts = hist["assets"]["persediaan_part"]
        total_fixed_assets = hist["assets"]["tetap"]
        
        # Re-fetch asset list for details
        assets_list = self.db.query(Aset).filter(
            Aset.tanggal_beli <= as_of_date,
            Aset.status == AssetStatus.AKTIF
        ).all()
        
        # Recalculate Piutang sum from DB for specific breakdown displayed in Balance Sheet
        # Use 'unit' field if possible, fallback to 'sumber'
        def get_piutang_sum_by_unit(unit: KasBankSource):
            return float(self.db.query(func.sum(PiutangUsaha.sisa_piutang)).filter(
                PiutangUsaha.unit == unit,
                PiutangUsaha.tanggal <= as_of_date,
                PiutangUsaha.status != PiutangStatus.LUNAS
            ).scalar() or 0)

        # Legacy sources (for records before migration)
        def get_piutang_sum_by_source(source: PiutangSource):
            return float(self.db.query(func.sum(PiutangUsaha.sisa_piutang)).filter(
                PiutangUsaha.sumber == source,
                PiutangUsaha.unit.is_(None), # Only legacy
                PiutangUsaha.tanggal <= as_of_date,
                PiutangUsaha.status != PiutangStatus.LUNAS
            ).scalar() or 0)

        # Unit-specific Piutang (Total = Unit Source + Records assigned to unit)
        piutang_bengkel = get_piutang_sum_by_unit(KasBankSource.BENGKEL) + get_piutang_sum_by_source(PiutangSource.BENGKEL)
        piutang_ja = get_piutang_sum_by_unit(KasBankSource.JASA_ANGKUT) + get_piutang_sum_by_source(PiutangSource.JASA_ANGKUT)
        piutang_mobil = get_piutang_sum_by_unit(KasBankSource.JUAL_BELI_MOBIL) + get_piutang_sum_by_source(PiutangSource.JUAL_BELI_MOBIL)
        
        # Kasbon and Others without specific unit mapping will use source only
        piutang_karyawan = get_piutang_sum_by_source(PiutangSource.KASBON_KARYAWAN)
        piutang_lainnya = get_piutang_sum_by_source(PiutangSource.LAINNYA)
        
        # Sum all for total assets
        total_piutang = piutang_bengkel + piutang_ja + piutang_mobil + piutang_karyawan + piutang_lainnya
        
        total_assets = total_cash + total_piutang + total_stock_mobil + total_stock_parts + total_fixed_assets

        # 2. LIABILITIES
        def get_hutang_sum_by_unit(unit: KasBankSource):
            return float(self.db.query(func.sum(HutangUsaha.sisa_hutang)).filter(
                HutangUsaha.unit == unit,
                HutangUsaha.tanggal <= as_of_date,
                HutangUsaha.status != HutangStatus.LUNAS
            ).scalar() or 0)

        def get_hutang_sum_by_source(source: HutangSource):
            return float(self.db.query(func.sum(HutangUsaha.sisa_hutang)).filter(
                HutangUsaha.sumber == source,
                HutangUsaha.unit.is_(None),
                HutangUsaha.tanggal <= as_of_date,
                HutangUsaha.status != HutangStatus.LUNAS
            ).scalar() or 0)

        hutang_part = get_hutang_sum_by_source(HutangSource.PEMBELIAN_PART)
        hutang_mobil = get_hutang_sum_by_source(HutangSource.PEMBELIAN_MOBIL) + get_hutang_sum_by_source(HutangSource.JUAL_BELI_MOBIL)
        hutang_lainnya = get_hutang_sum_by_source(HutangSource.LAINNYA)
        
        # Unit specific hutang (e.g. from manual entry)
        hutang_bengkel = get_hutang_sum_by_unit(KasBankSource.BENGKEL)
        hutang_ja = get_hutang_sum_by_unit(KasBankSource.JASA_ANGKUT)
        hutang_mobil_unit = get_hutang_sum_by_unit(KasBankSource.JUAL_BELI_MOBIL)

        # Hutang Investor (Laba yang belum dicairkan)
        hutang_investor = float(self.db.query(
            func.sum(TransaksiPenjualanMobil.laba_investor - TransaksiPenjualanMobil.nominal_pencairan)
        ).join(Mobil, TransaksiPenjualanMobil.mobil_id == Mobil.id).filter(
            TransaksiPenjualanMobil.tanggal <= as_of_date,
            TransaksiPenjualanMobil.status_pencairan != InvestorDisbursementStatus.DICAIRKAN
        ).scalar() or 0)

        total_liabilities = hutang_part + hutang_mobil + hutang_lainnya + hutang_investor + hutang_bengkel + hutang_ja + hutang_mobil_unit

        # 3. EQUITY & PROFIT — Snapshot Identity Approach
        # Balance Sheet Identity: Assets = Liabilities + Equity
        # Therefore: Equity = Assets - Liabilities (always balanced by construction)
        total_equity = total_assets - total_liabilities
        
        # We reuse 'hist' fetched at the start for consistent consolidated profit logic
        prive_total = float(hist.get("prive_global", 0))
        
        # Net Consolidated Profit for the company
        retained_earnings = float(hist.get("retained_earnings", 0))
        
        # Modal Setoran (Total cash inflow from MODAL source + Official injections)
        setoran_modal = float(self.db.query(func.sum(KasBank.nominal)).filter(
            or_(
                KasBank.sumber == KasBankSource.MODAL,
                KasBank.keterangan.ilike("%Terima Dana dari Akun Utama%")
            ),
            KasBank.tipe == KasBankType.MASUK,
            KasBank.tanggal <= as_of_date
        ).scalar() or 0)
        
        # Non-cash capital tied in assets (shown for transparency in the equity breakdown)
        # These values represent capital deployed into physical/non-cash assets.
        modal_persediaan = total_stock_parts
        modal_stok_mobil = total_stock_mobil
        modal_aset_tetap = total_fixed_assets
        
        # The equity breakdown shows WHERE the capital is held:
        # - Cash component: setoran_modal + retained_earnings - prive = what SHOULD be in cash
        # - Non-cash component: inventory + fixed assets = what's tied up in physical property
        # The total always equals total_equity by the balance sheet identity.
        # No "selisih" needed because this is a snapshot, not a flow reconciliation.
        equity_per_komponen = setoran_modal + retained_earnings - prive_total
        
        total_pasiva = total_liabilities + total_equity
        
        report_selisih = total_assets - total_pasiva
        is_balanced = abs(report_selisih) < 100 

        return {
            "periode": as_of_date.isoformat(),
            "aktiva_lancar": {
                "kas_tunai": kas_tunai,
                "kas_bank": kas_bank,
                "unit_cash": unit_cash,
                "unit_details": unit_details,
                "total_kas_bank": total_cash,
                "piutang_usaha": piutang_bengkel,
                "piutang_mobil": piutang_mobil,
                "piutang_jasa_angkut": piutang_ja,
                "piutang_karyawan": piutang_karyawan,
                "piutang_lainnya": piutang_lainnya,
                "total_piutang": total_piutang,
                "persediaan_sparepart": total_stock_parts,
                "stok_mobil": total_stock_mobil,
                "total_aktiva_lancar": total_assets - total_fixed_assets
            },
            "aktiva_tetap": {
                "total_aktiva_tetap": total_fixed_assets,
                "detail_aset": [
                    {"kode": a.kode, "nama": a.nama, "harga_beli": float(a.harga_beli)} 
                    for a in assets_list
                ]
            },
            "total_aktiva": total_assets,
            "hutang": {
                "hutang_part": hutang_part,
                "hutang_mobil": hutang_mobil,
                "hutang_investor": hutang_investor,
                "hutang_lainnya": hutang_lainnya,
                "total_hutang": total_liabilities
            },
            "modal": {
                "setoran_modal": setoran_modal,
                "laba_ditahan": retained_earnings,
                "prive": prive_total,
                "modal_persediaan": modal_persediaan,
                "modal_stok_mobil": modal_stok_mobil,
                "modal_aset_tetap": modal_aset_tetap,
                "selisih_modal": 0,
                "modal_komponen": total_equity,
                "total_modal": total_equity
            },
            "total_pasiva": total_pasiva,
            "selisih": report_selisih,
            "is_balanced": is_balanced
        }
