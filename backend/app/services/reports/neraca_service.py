from datetime import date
from decimal import Decimal
from typing import Dict, Any
from sqlalchemy import func, or_
from app.services.reports.base import BaseReportService
from app.models.keuangan import KasBank, PiutangUsaha, HutangUsaha, Aset
from app.models.mobil import Mobil
from app.models.bengkel import SparePart
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
        
        # 1. ASSETS
        
        # Cash & Bank Balances
        balances = {}
        for jenis in KasBankJenis:
            last_kb = self.db.query(KasBank).filter(
                KasBank.jenis == jenis,
                KasBank.tanggal <= as_of_date
            ).order_by(KasBank.id.desc()).first()
            balances[jenis.name] = float(last_kb.saldo_sesudah if last_kb else 0)
        
        total_cash = sum(balances.values())
        kas_tunai = balances.get("CASH", 0) + balances.get("KAS_UTAMA", 0)
        kas_bank = sum(v for k, v in balances.items() if "BANK" in k)
        unit_cash = sum(v for k, v in balances.items() if "KAS_UNIT" in k)

        # Piutang breakdown
        def get_piutang_sum(source: PiutangSource):
            return float(self.db.query(func.sum(PiutangUsaha.sisa_piutang)).filter(
                PiutangUsaha.sumber == source,
                PiutangUsaha.tanggal <= as_of_date,
                PiutangUsaha.status != PiutangStatus.LUNAS
            ).scalar() or 0)

        piutang_bengkel = get_piutang_sum(PiutangSource.BENGKEL)
        piutang_mobil = get_piutang_sum(PiutangSource.JUAL_BELI_MOBIL)
        piutang_ja = get_piutang_sum(PiutangSource.JASA_ANGKUT)
        piutang_karyawan = get_piutang_sum(PiutangSource.KASBON_KARYAWAN)
        piutang_lainnya = get_piutang_sum(PiutangSource.LAINNYA)
        total_piutang = piutang_bengkel + piutang_mobil + piutang_ja + piutang_karyawan + piutang_lainnya

        # Inventory (Mobil stock value includes Buy + Prep + Dandan = total_modal)
        total_stock_mobil = float(self.db.query(func.sum(Mobil.total_modal)).filter(
            Mobil.tanggal_masuk <= as_of_date,
            or_(Mobil.tanggal_terjual.is_(None), Mobil.tanggal_terjual > as_of_date)
        ).scalar() or 0)
        total_stock_parts = float(self.db.query(func.sum(SparePart.stok * SparePart.harga_beli)).scalar() or 0)

        # Fixed Assets
        assets_list = self.db.query(Aset).filter(
            Aset.tanggal_beli <= as_of_date,
            Aset.status == AssetStatus.AKTIF
        ).all()
        total_fixed_assets = sum(float(a.harga_beli) for a in assets_list)

        # 2. LIABILITIES
        def get_hutang_sum(source: HutangSource):
            return float(self.db.query(func.sum(HutangUsaha.sisa_hutang)).filter(
                HutangUsaha.sumber == source,
                HutangUsaha.tanggal <= as_of_date,
                HutangUsaha.status != HutangStatus.LUNAS
            ).scalar() or 0)

        hutang_part = get_hutang_sum(HutangSource.PEMBELIAN_PART)
        hutang_mobil = get_hutang_sum(HutangSource.PEMBELIAN_MOBIL) + get_hutang_sum(HutangSource.JUAL_BELI_MOBIL)
        hutang_lainnya = get_hutang_sum(HutangSource.LAINNYA)
        
        # Add accrual for Investor Profit and pending payouts
        from app.models.mobil import TransaksiPenjualanMobil, Mobil
        from app.utils.constants import InvestorDisbursementStatus, OwnershipType
        
        hutang_investor = float(self.db.query(
            func.sum(TransaksiPenjualanMobil.laba_investor - TransaksiPenjualanMobil.nominal_pencairan)
        ).join(Mobil, TransaksiPenjualanMobil.mobil_id == Mobil.id).filter(
            TransaksiPenjualanMobil.tipe_kepemilikan == OwnershipType.INVESTOR,
            TransaksiPenjualanMobil.tanggal <= as_of_date,
            TransaksiPenjualanMobil.status_pencairan != InvestorDisbursementStatus.DICAIRKAN
        ).scalar() or 0)
        
        total_liabilities = hutang_part + hutang_mobil + hutang_lainnya + hutang_investor

        # 3. EQUITY & PROFIT (Consolidated from reports logic)
        start_of_time = date(2020, 1, 1) 
        hist = self.get_unit_financial_breakdown(start_of_time, as_of_date)

        # Net Profits of units (These are already netted by our new dynamic logic)
        laba_bengkel = hist["units"]["bengkel"]["laba_kotor"] - hist["units"]["bengkel"]["total_expenses"] - hist["units"]["bengkel"]["gaji"]
        laba_ja = hist["units"]["jasa_angkut"]["revenue_tpm"] - (hist["units"]["jasa_angkut"]["repairs"] + hist["units"]["jasa_angkut"]["armada_ops"] + hist["units"]["jasa_angkut"]["overhead"])
        laba_mobil = float(hist["units"]["mobil"]["laba_tpm"])
        
        total_laba = laba_bengkel + laba_ja + laba_mobil
        prive = hist["prive_global"]
        overhead_umum = hist["units"]["bengkel"]["common_expenses"]
        
        # Modal Setoran (Cumulative)
        setoran_modal = float(self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.sumber == KasBankSource.MODAL,
            KasBank.tipe == KasBankType.MASUK,
            KasBank.tanggal <= as_of_date
        ).scalar() or 0)

        total_assets = total_cash + total_piutang + total_stock_mobil + total_stock_parts + total_fixed_assets
        
        # Total Modal based on components
        total_modal_komponen = setoran_modal + total_laba - prive - overhead_umum
        total_pasiva = total_liabilities + total_modal_komponen

        return {
            "periode": as_of_date.isoformat(),
            "aktiva_lancar": {
                "kas_tunai": kas_tunai,
                "kas_bank": kas_bank,
                "unit_cash": unit_cash,
                "unit_details": { k.lower(): v for k, v in balances.items() if "KAS_UNIT" in k },
                "total_kas_bank": total_cash,
                "piutang_usaha": piutang_bengkel,
                "piutang_mobil": piutang_mobil,
                "piutang_part_mobil": 0,
                "piutang_jasa_angkut": piutang_ja,
                "piutang_karyawan": piutang_karyawan,
                "piutang_lainnya": piutang_lainnya,
                "total_piutang": total_piutang,
                "persediaan_sparepart": total_stock_parts,
                "stok_mobil": total_stock_mobil,
                "total_aktiva_lancar": total_cash + total_piutang + total_stock_parts + total_stock_mobil
            },
            "aktiva_tetap": {
                "detail_aset": [
                    {"kode": a.kode, "nama": a.nama, "harga_beli": float(a.harga_beli)} 
                    for a in assets_list
                ],
                "total_aktiva_tetap": total_fixed_assets
            },
            "modal": {
                "setoran_modal": setoran_modal,
                "modal_persediaan": total_stock_parts + total_stock_mobil,
                "laba_kotor": total_laba + overhead_umum,
                "laba_ditahan": total_laba,
                "detail_laba": {
                    "bengkel": laba_bengkel,
                    "mobil": laba_mobil,
                    "jasa_angkut": laba_ja
                },
                "total_beban": overhead_umum,
                "prive": prive,
                "pencairan_investor": 0, # This can be expanded later if needed
                "total_modal": total_modal_komponen
            },
            "hutang": {
                "hutang_part": hutang_part,
                "hutang_mobil": hutang_mobil,
                "hutang_investor": hutang_investor,
                "hutang_lainnya": hutang_lainnya,
                "total_hutang": total_liabilities
            },
            "total_aktiva": total_assets,
            "total_pasiva": total_pasiva,
            "is_balanced": abs(total_assets - total_pasiva) < 100, # Allow small rounding diff
            "selisih": float(total_assets - total_pasiva)
        }
