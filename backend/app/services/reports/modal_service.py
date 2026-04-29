from app.utils.constants import AssetStatus
from app.utils.constants import CarStatus
from datetime import date, timedelta
from typing import Dict, Any
from sqlalchemy import func, or_, and_, case
from app.services.reports.base import BaseReportService
from app.models.keuangan import KasBank, HutangUsaha, PiutangUsaha, PembayaranHutang, PembayaranPiutang
from app.models.mobil import Mobil, TransaksiPenjualanMobil
from app.models.bengkel import TransaksiPenjualanBengkel, PembelianSparePart, DetailTransaksiSpareParts
from app.utils.constants import (
    KasBankSource, 
    KasBankType, 
    KasBankJenis,
    PiutangStatus,
    PiutangSource,
    HutangStatus,
    HutangSource,
    InvestorDisbursementStatus,
    OwnershipType,
    PaymentStatus,
    PaymentMethod
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
        raw_start_m_stock = start_hist["assets"].get("persediaan_mobil", 0)
        start_stok_mobil = float(raw_start_m_stock.get("total", 0)) if isinstance(raw_start_m_stock, dict) else float(raw_start_m_stock)
        start_aset_tetap = float(start_hist["assets"].get("tetap", 0))
        # Opening debt and piutang should be the balances as of yesterday
        # We use the raw summaries from our historical snapshot to ensure consistency 
        # with the current period's asset calculations (including internal eliminations,
        # investor debt, and accrued expenses).
        start_piutang = float(start_hist["raw_summaries"]["piutang"].get("total", 0))
        start_hutang = float(start_hist["raw_summaries"]["hutang"].get("total", 0))

        # TOTAL OPENING EQUITY = (Cash + Assets) - Liabilities
        modal_awal_theoretical = (start_cash + start_stok_part + start_stok_mobil + start_aset_tetap + start_piutang) - start_hutang
        
        # Modal Masuk (Setoran Baru in this period)
        setoran_modal = float(self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.sumber == KasBankSource.MODAL,
            KasBank.tipe == KasBankType.MASUK,
            KasBank.tanggal >= tanggal_dari,
            KasBank.tanggal <= tanggal_sampai
        ).scalar() or 0)

        # Get Current Period Financial Breakdown (Source of Truth for unit performances)
        data = self.get_unit_financial_breakdown(tanggal_dari, tanggal_sampai)
        b = data["units"].get("bengkel", {})
        m = data["units"].get("mobil", {})
        ja = data["units"].get("jasa_angkut", {})

        # Calculate period profit using retained_earnings from BaseReportService (Source of Truth)
        # This correctly accounts for: internal elimination, trip costs, all overhead deductions
        period_profit_sot = float(data.get("retained_earnings", 0))
        
        # Unit-level breakdown for display only (Info section)
        laba_bengkel = float(b.get("laba_kotor", 0)) - float(b.get("total_expenses", 0)) - float(b.get("common_expenses", 0))
        laba_mobil_net = float(m.get("total_laba_kotor", 0)) - float(m.get("overhead", 0))
        # JA net profit = revenue - trip_costs - repairs - overhead - armada_ops - armada_ops_ledger
        laba_ja = float(ja.get("revenue_tpm", 0)) - float(ja.get("trip_costs", 0)) - float(ja.get("repairs", 0)) - float(ja.get("overhead", 0)) - float(ja.get("armada_ops", 0)) - float(ja.get("armada_ops_ledger", 0))
        laba_bersih_unit = period_profit_sot  # Use the consolidated figure
        
        # Snapshot inventory/fixed assets that represent capital tied in non-cash assets.
        # These values are also shown in Section A breakdown and must be capitalized
        # so Section B (which lists the same assets as non-cash components) does not
        # create artificial negative theoretical modal.
        persediaan_part = float(data["assets"].get("persediaan_part", 0))
        # Handle both old float and new dict format for backward compatibility during migration
        raw_m_stock = data["assets"].get("persediaan_mobil", 0)
        if isinstance(raw_m_stock, dict):
            persediaan_mobil = float(raw_m_stock.get("total", 0))
            persediaan_mobil_prep = float(raw_m_stock.get("biaya_persiapan", 0))
            persediaan_mobil_price = float(raw_m_stock.get("harga_beli", 0))
            persediaan_mobil_ws_int = float(raw_m_stock.get("perbaikan_internal", 0))
            persediaan_mobil_ws_ext = float(raw_m_stock.get("perbaikan_external", 0))
        else:
            persediaan_mobil = float(raw_m_stock)
            persediaan_mobil_prep = 0
            persediaan_mobil_price = persediaan_mobil
            persediaan_mobil_ws_int = 0
            persediaan_mobil_ws_ext = 0
            
        aset_tetap = float(data["assets"].get("tetap", 0))

        # ══════════════════════════════════════════════════════════════
        # MODAL NON-KAS: Period Delta
        # Because modal_awal already includes cumulative non-cash assets,
        # we only want to add the NEW non-cash assets introduced in this period.
        # ══════════════════════════════════════════════════════════════
        def get_modal_non_kas(as_of_date: date, assets_total: float) -> float:
            from app.models.bengkel import PembelianSparePart
            p_part = float(self.db.query(func.sum(PembelianSparePart.grand_total)).filter(
                PembelianSparePart.tanggal <= as_of_date
            ).scalar() or 0)
            # Strict matching: Only subtract cash payments that are explicitly linked to an asset ID
            p_aset = float(self.db.query(func.sum(KasBank.nominal)).filter(
                KasBank.tipe == KasBankType.KELUAR, 
                KasBank.sumber == KasBankSource.ASET, 
                KasBank.referensi_id.is_not(None),
                KasBank.tanggal <= as_of_date
            ).scalar() or 0)
            p_mobil = float(self.db.query(func.sum(KasBank.nominal)).filter(
                KasBank.tipe == KasBankType.KELUAR, 
                KasBank.sumber.in_([KasBankSource.PEMBELIAN_MOBIL, KasBankSource.JUAL_BELI_MOBIL]),
                ~KasBank.keterangan.ilike("Transfer %"),
                ~KasBank.keterangan.ilike("%Pelunasan Biaya Repair Internal%"),
                KasBank.tanggal <= as_of_date
            ).scalar() or 0)
            
            return max(0, assets_total - (p_part + p_aset + p_mobil))

        from app.models.bengkel import TransaksiPenjualanBengkel, DetailTransaksiSpareParts
        
        # Helper to get accumulated HPP up to a specific date
        def get_akumulasi_hpp_parts(d: date) -> float:
            return float(self.db.query(func.sum(DetailTransaksiSpareParts.harga_beli * DetailTransaksiSpareParts.qty)).join(
                TransaksiPenjualanBengkel, DetailTransaksiSpareParts.transaksi_id == TransaksiPenjualanBengkel.id
            ).filter(
                TransaksiPenjualanBengkel.status_bayar != PaymentStatus.BATAL,
                TransaksiPenjualanBengkel.tanggal <= d
            ).scalar() or 0)
            
        def get_akumulasi_hpp_mobil(d: date) -> float:
            from app.models.mobil import Mobil
            return float(self.db.query(func.sum(Mobil.harga_beli)).filter(
                Mobil.status == CarStatus.TERJUAL,
                Mobil.tanggal_terjual <= d
            ).scalar() or 0)
            
        def get_akumulasi_hpp_mobil_prep(d: date) -> float:
            from app.models.bengkel import PengeluaranBengkel
            from app.models.mobil import Mobil
            return float(self.db.query(func.sum(PengeluaranBengkel.jumlah)).join(Mobil).filter(
                PengeluaranBengkel.bisnis_kategori.in_(["mobil", "jual_beli_mobil", "penjualan_mobil"]),
                Mobil.status == CarStatus.TERJUAL,
                Mobil.tanggal_terjual <= d,
                PengeluaranBengkel.tanggal <= d
            ).scalar() or 0)
            
        # Snapshot Start (Yesterday)
        p_aset_start = float(self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.tipe == KasBankType.KELUAR, 
            KasBank.sumber == KasBankSource.ASET, 
            KasBank.referensi_id.is_not(None),
            KasBank.tanggal <= yesterday
        ).scalar() or 0)
        modal_aset_tetap_start = max(0, start_aset_tetap - p_aset_start)

        p_part_start = float(self.db.query(func.sum(PembelianSparePart.grand_total)).filter(
            PembelianSparePart.tanggal <= yesterday
        ).scalar() or 0)
        modal_stok_part_start = max(0, (start_stok_part + get_akumulasi_hpp_parts(yesterday)) - p_part_start)

        p_mobil_start = float(self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.tipe == KasBankType.KELUAR, 
            KasBank.sumber.in_([KasBankSource.PEMBELIAN_MOBIL, KasBankSource.JUAL_BELI_MOBIL]),
            ~KasBank.keterangan.ilike("Transfer %"),
            ~KasBank.keterangan.ilike("%Pelunasan Biaya Repair Internal%"),
            KasBank.tanggal <= yesterday
        ).scalar() or 0)
        h_mobil_start = float(self.db.query(func.sum(HutangUsaha.nominal_hutang)).filter(
            HutangUsaha.sumber == HutangSource.PEMBELIAN_MOBIL,
            HutangUsaha.tanggal <= yesterday
        ).scalar() or 0)
        modal_stok_mobil_start = max(0, (start_stok_mobil + get_akumulasi_hpp_mobil(yesterday) + get_akumulasi_hpp_mobil_prep(yesterday)) - (p_mobil_start + h_mobil_start))

        # Snapshot End (Today)
        p_aset_end = float(self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.tipe == KasBankType.KELUAR, 
            KasBank.sumber == KasBankSource.ASET, 
            KasBank.referensi_id.is_not(None),
            KasBank.tanggal <= tanggal_sampai
        ).scalar() or 0)
        modal_aset_tetap_end = max(0, aset_tetap - p_aset_end)

        p_part_end = float(self.db.query(func.sum(PembelianSparePart.grand_total)).filter(
            PembelianSparePart.tanggal <= tanggal_sampai
        ).scalar() or 0)
        modal_stok_part_end = max(0, (persediaan_part + get_akumulasi_hpp_parts(tanggal_sampai)) - p_part_end)

        p_mobil_end = float(self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.tipe == KasBankType.KELUAR, 
            KasBank.sumber.in_([KasBankSource.PEMBELIAN_MOBIL, KasBankSource.JUAL_BELI_MOBIL]),
            ~KasBank.keterangan.ilike("Transfer %"),
            ~KasBank.keterangan.ilike("%Pelunasan Biaya Repair Internal%"),
            KasBank.tanggal <= tanggal_sampai
        ).scalar() or 0)
        h_mobil_end = float(self.db.query(func.sum(HutangUsaha.nominal_hutang)).filter(
            HutangUsaha.sumber == HutangSource.PEMBELIAN_MOBIL,
            HutangUsaha.tanggal <= tanggal_sampai
        ).scalar() or 0)
        modal_stok_mobil_end = max(0, (persediaan_mobil + get_akumulasi_hpp_mobil(tanggal_sampai) + get_akumulasi_hpp_mobil_prep(tanggal_sampai)) - (p_mobil_end + h_mobil_end))

        # The Change (Penambahan) is the increase during the period
        modal_aset_tetap_delta = max(0, modal_aset_tetap_end - modal_aset_tetap_start)
        modal_stok_part_delta = max(0, modal_stok_part_end - modal_stok_part_start)
        modal_stok_mobil_delta = max(0, modal_stok_mobil_end - modal_stok_mobil_start)

        total_non_kas = modal_aset_tetap_delta + modal_stok_part_delta + modal_stok_mobil_delta
        
        # Period Profit = Accrual Profit (All units)
        period_profit = laba_bersih_unit
        
        hpp_bengkel_val = float(b.get("total_hpp", 0))
        # HPP Mobil = purchase price + prep cost + bengkel repairs for SOLD cars only.
        # Use "repairs" (sold cars only), NOT "repairs_total" (all cars including unsold).
        # Unsold car repairs are inventory (in Section B stok_mobil), not COGS.
        hpp_mobil_val = float(m.get("purchase_hpp", 0) + m.get("prep_hpp", 0) + m.get("repairs", 0))

        # Section A should represent Total Capital Position at End of Period
        # We use the SNAPSHOT approach: Ending Equity = Actual Cash + Non-Cash Assets - Liabilities
        # total_a is computed AFTER Section B and E so it uses the EXACT same values,
        # guaranteeing A - B + E = actual cash (penyesuaian = 0) by construction.
        
        # Compute actual cash at end of period (needed for Section D)
        # Compute actual cash at end of period (for Info Aset)
        end_total_cash = 0
        for jenis in KasBankJenis:
            last_kb = self.db.query(KasBank.saldo_sesudah).filter(
                KasBank.jenis == jenis,
                KasBank.tanggal <= tanggal_sampai
            ).order_by(KasBank.id.desc()).first()
            val = float(last_kb[0] if last_kb else 0)
            end_total_cash += val

        def _piutang_saldo_source(source: PiutangSource) -> float:
            return float(self.db.query(func.sum(PiutangUsaha.sisa_piutang)).filter(
                PiutangUsaha.sumber == source, 
                PiutangUsaha.tanggal <= tanggal_sampai,
                PiutangUsaha.status != PiutangStatus.BATAL
            ).scalar() or 0)

        def _piutang_saldo_unit_refined(unit: KasBankSource, source: PiutangSource, internal_jb_mobil: str = "all") -> float:
            # Only count if BOTH unit and source match (avoids counting LAINNYA/KASBON here)
            q_unit = self.db.query(func.sum(PiutangUsaha.sisa_piutang)).filter(
                PiutangUsaha.unit == unit, 
                PiutangUsaha.sumber == source,
                PiutangUsaha.tanggal <= tanggal_sampai,
                PiutangUsaha.status != PiutangStatus.BATAL
            )
            q_legacy = self.db.query(func.sum(PiutangUsaha.sisa_piutang)).filter(
                PiutangUsaha.sumber == source, 
                PiutangUsaha.unit.is_(None), 
                PiutangUsaha.tanggal <= tanggal_sampai,
                PiutangUsaha.status != PiutangStatus.BATAL
            )
            if unit == KasBankSource.JUAL_BELI_MOBIL:
                if internal_jb_mobil == "only_internal":
                    q_unit = q_unit.filter(PiutangUsaha.nama_debitur.ilike("JB MOBIL -%"))
                    q_legacy = q_legacy.filter(PiutangUsaha.nama_debitur.ilike("JB MOBIL -%"))
                elif internal_jb_mobil == "exclude_internal":
                    q_unit = q_unit.filter(~PiutangUsaha.nama_debitur.ilike("JB MOBIL -%"))
                    q_legacy = q_legacy.filter(~PiutangUsaha.nama_debitur.ilike("JB MOBIL -%"))
            return float(q_unit.scalar() or 0) + float(q_legacy.scalar() or 0)

        total_piutang = (
            _piutang_saldo_unit_refined(KasBankSource.BENGKEL, PiutangSource.BENGKEL, internal_jb_mobil="exclude_internal") +
            _piutang_saldo_unit_refined(KasBankSource.JUAL_BELI_MOBIL, PiutangSource.JUAL_BELI_MOBIL, internal_jb_mobil="exclude_internal") +
            _piutang_saldo_unit_refined(KasBankSource.JASA_ANGKUT, PiutangSource.JASA_ANGKUT) +
            _piutang_saldo_source(PiutangSource.KASBON_KARYAWAN) +
            _piutang_saldo_source(PiutangSource.LAINNYA)
        )

        # Pengurangan Modal
        prive = float(data.get("prive_global", 0))
        pengembalian_modal = float(self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.tipe == KasBankType.KELUAR,
            KasBank.sumber == KasBankSource.MODAL,
            KasBank.tanggal >= tanggal_dari,
            KasBank.tanggal <= tanggal_sampai
        ).scalar() or 0)

        # Beban Gaji & Lembur
        gaji = float(b.get("gaji", 0))
        lembur = float(b.get("lembur", 0))
        
        # Breakdown Beban Operasional
        ops_umum = float(b.get("common_expenses", 0)) + float(data.get("admin_fees_unrecorded", 0)) + float(data.get("ja_untracked_gap", 0))
        ops_bengkel = float(b.get("total_expenses", 0))
        # Mobil Breakdown: Include tagged costs (prep/repairs) in operational deduction
        # because those represent cash outflows during this period.
        ops_mobil = float(m.get("overhead", 0)) + float(m.get("prep_total", 0)) + float(m.get("repairs_total", 0))
        
        # Jasa Angkut Breakdown: Unit vs Trip/Armada
        # Note: ja.get("armada_ops", 0) already includes trip_costs if they are recorded 
        # in the armada expense ledger. Summing both causes double counting.
        ops_ja_unit = float(ja.get("overhead", 0)) + float(ja.get("armada_ops_ledger", 0))
        ops_ja_trip = float(ja.get("armada_ops", 0)) 
        ops_ja = ops_ja_unit + ops_ja_trip
        
        # Note: ja.get("repairs", 0) is excluded because it's an internal workshop bill 
        # which is already accounted for via internal_elimination in consolidated profit.
        
        total_ops = ops_umum + ops_bengkel + ops_mobil + ops_ja

        # Laba Kotor (Gross Profit) per unit
        laba_mobil_gross = float(data["units"]["mobil"].get("total_laba_kotor", 0))
        laba_ja_gross = float(data["units"]["jasa_angkut"].get("revenue_tpm", 0))
        laba_bengkel_gross = float(data["units"]["bengkel"].get("laba_kotor", 0))

        # Laba Kotor (Gross Profit) = Sum of all units' gross profit
        # This is more accurate than the add-back method as it avoids double-counting 
        # capitalized costs (prep/repairs) which are handled in Section B separately.
        laba_kotor = laba_mobil_gross + laba_ja_gross + laba_bengkel_gross

        # 1. Mobil Stock Rotation
        beli_mobil = float(self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.tipe == KasBankType.KELUAR,
            KasBank.sumber == KasBankSource.PEMBELIAN_MOBIL,
            KasBank.tanggal >= tanggal_dari,
            KasBank.tanggal <= tanggal_sampai
        ).scalar() or 0)
        
        # penambahan_stok_mobil should include:
        # 1. Purchase price of new cars bought in this period
        # 2. Preparation/Repair costs paid in this period (as they increase asset value)
        penambahan_stok_mobil = float(self.db.query(func.sum(Mobil.harga_beli)).filter(
            Mobil.tanggal_masuk >= tanggal_dari,
            Mobil.tanggal_masuk <= tanggal_sampai,
            Mobil.deleted_at.is_(None)
        ).scalar() or 0) + float(m.get("prep_total", 0)) + float(m.get("repairs_total", 0))

        # 2. Spare Part Stock Rotation
        penambahan_stok_sparepart = float(self.db.query(func.sum(PembelianSparePart.grand_total)).filter(
            PembelianSparePart.tanggal >= tanggal_dari,
            PembelianSparePart.tanggal <= tanggal_sampai
        ).scalar() or 0)

        beli_sparepart = float(self.db.query(func.sum(PembelianSparePart.grand_total)).filter(
            PembelianSparePart.tanggal_bayar >= tanggal_dari,
            PembelianSparePart.tanggal_bayar <= tanggal_sampai,
            PembelianSparePart.metode_bayar == PaymentMethod.TUNAI
        ).scalar() or 0)

        # 3. Hutang Baru & Pembayaran Hutang (Stock-related balancing)
        # This fixes the 5M discrepancy when cars/parts are bought on debt.
        # Gross stock additions must be balanced by their funding sources (Cash + New Debt).
        
        # New debt incurred (unpaid portion of stock bought in this period)
        hutang_mobil_baru = float(self.db.query(func.sum(HutangUsaha.sisa_hutang)).filter(
            HutangUsaha.sumber == HutangSource.PEMBELIAN_MOBIL,
            HutangUsaha.tanggal >= tanggal_dari,
            HutangUsaha.tanggal <= tanggal_sampai,
            HutangUsaha.status != HutangStatus.BATAL
        ).scalar() or 0)
        
        hutang_part_baru = float(self.db.query(func.sum(HutangUsaha.sisa_hutang)).filter(
            HutangUsaha.sumber == HutangSource.PEMBELIAN_PART,
            HutangUsaha.tanggal >= tanggal_dari,
            HutangUsaha.tanggal <= tanggal_sampai,
            HutangUsaha.status != HutangStatus.BATAL
        ).scalar() or 0)
        
        # Debt payments made in this period (needed because they reduce cash but don't increase stock)
        pembayaran_hutang_mobil = float(self.db.query(func.sum(PembayaranHutang.nominal)).join(HutangUsaha).filter(
            HutangUsaha.sumber == HutangSource.PEMBELIAN_MOBIL,
            PembayaranHutang.tanggal >= tanggal_dari,
            PembayaranHutang.tanggal <= tanggal_sampai
        ).scalar() or 0)
        
        pembayaran_hutang_part = float(self.db.query(func.sum(PembayaranHutang.nominal)).join(HutangUsaha).filter(
            HutangUsaha.sumber == HutangSource.PEMBELIAN_PART,
            PembayaranHutang.tanggal >= tanggal_dari,
            PembayaranHutang.tanggal <= tanggal_sampai
        ).scalar() or 0)

        total_penambahan = (
            setoran_modal + total_non_kas + laba_kotor + 
            penambahan_stok_mobil + penambahan_stok_sparepart +
            pembayaran_hutang_mobil + pembayaran_hutang_part
        )
        total_pengurangan = (
            prive + pengembalian_modal + gaji + lembur + total_ops + 
            beli_mobil + beli_sparepart + 
            hutang_mobil_baru + hutang_part_baru + 
            pembayaran_hutang_mobil + pembayaran_hutang_part
        )

        modal_akhir = modal_awal_theoretical + total_penambahan - total_pengurangan

        # Total overhead untuk info unit bisnis
        total_overhead_gaji = total_ops + gaji + lembur

        # Validation (Comparison: Theoretical vs Actual Assets)
        piutang_akhir = float(data["raw_summaries"]["piutang"].get("total", 0))
        hutang_akhir = float(data["raw_summaries"]["hutang"].get("total", 0))
        
        # Note: persediaan_mobil here already includes Prep (Wallet), and piutang_akhir 
        # includes Internal Workshop repairs (Receivable). 
        # Combined, they represent the total value increase of the car inventory.
        modal_aktual = (end_total_cash + persediaan_part + persediaan_mobil + aset_tetap + piutang_akhir) - hutang_akhir
        selisih = modal_akhir - modal_aktual

        return {
            "periode": data["periode"],
            "modal_awal": modal_awal_theoretical,
            "penambahan": {
                "setoran_modal": setoran_modal,
                "modal_non_kas": {
                    "total": total_non_kas,
                    "aset_tetap": modal_aset_tetap_delta,
                    "stok_part": modal_stok_part_delta,
                    "stok_mobil": modal_stok_mobil_delta
                },
                "laba_kotor": {
                    "total": laba_kotor,
                    "mobil": laba_mobil_gross,
                    "ja": laba_ja_gross,
                    "bengkel": laba_bengkel_gross
                },
                "penambahan_stok": {
                    "total": penambahan_stok_mobil + penambahan_stok_sparepart,
                    "mobil": penambahan_stok_mobil,
                    "sparepart": penambahan_stok_sparepart
                },
                "pelunasan_hutang": pembayaran_hutang_mobil + pembayaran_hutang_part,
                "total": total_penambahan
            },
            "pengurangan": {
                "gaji": gaji,
                "lembur": lembur,
                "ops_umum": ops_umum,
                "ops_bengkel": ops_bengkel,
                "ops_mobil": ops_mobil,
                "ops_ja": {
                    "total": ops_ja,
                    "unit": ops_ja_unit,
                    "trip": ops_ja_trip
                },
                "prive": prive,
                "pengembalian_modal": pengembalian_modal,
                "pembelian_mobil": beli_mobil,
                "pembelian_sparepart": beli_sparepart,
                "hutang_baru": hutang_mobil_baru + hutang_part_baru,
                "pembayaran_hutang": pembayaran_hutang_mobil + pembayaran_hutang_part,
                "total": total_pengurangan
            },
            "modal_akhir": modal_akhir,
            "info": {
                "laba_bengkel": laba_bengkel,
                "laba_mobil": laba_mobil_net,
                "laba_jasa_angkut": laba_ja,
                "overhead_gaji": total_overhead_gaji,
                "aset": {
                    "kas_bank": end_total_cash,
                    "stok_part": persediaan_part,
                    "stok_mobil": {
                        "total": persediaan_mobil + persediaan_mobil_ws_int,
                        "unit_hanya": persediaan_mobil_price,
                        "biaya_persiapan": persediaan_mobil_prep,
                        "perbaikan_external": persediaan_mobil_ws_ext,
                        "perbaikan_internal": persediaan_mobil_ws_int
                    },
                    "aset_tetap": aset_tetap,
                    "piutang": data["raw_summaries"].get("piutang", {}),
                    "hutang": data["raw_summaries"].get("hutang", {})
                },
                "validasi": {
                    "modal_teoritis": modal_akhir,
                    "modal_aktual": modal_aktual,
                    "selisih": selisih,
                    "status": "BALANCE" if abs(selisih) < 100 else "SELISIH"
                }
            }
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
        # Always Ready (stok=999) = catalog only, modal = 0
        # Normal items = stok × harga_beli
        from app.models.bengkel import SparePart
        return float(self.db.query(func.sum(
            case(
                (SparePart.stok == 999, 0),
                else_=SparePart.stok * SparePart.harga_beli
            )
        )).filter(SparePart.deleted_at.is_(None)).scalar() or 0)

    def get_car_stock_value(self, as_of: date) -> float:
        """Calculate car inventory value as of date (Price + Prep).
        Note: Internal repairs are excluded here because they are in piutang_internal.
        """
        from app.models.mobil import Mobil, MobilBiayaLainnya
        
        # 1. Base Purchase Price
        price_q = self.db.query(func.sum(Mobil.harga_beli)).filter(
            Mobil.tanggal_masuk <= as_of,
            or_(
                Mobil.tanggal_terjual.is_(None),
                Mobil.tanggal_terjual > as_of
            ),
            Mobil.deleted_at.is_(None)
        )
        total_price = float(price_q.scalar() or 0)

        # 2. Preparation Costs (from MobilBiayaLainnya)
        # Filter for same cars (unsold as of date)
        prep_q = self.db.query(func.sum(MobilBiayaLainnya.jumlah)).join(Mobil).filter(
            Mobil.tanggal_masuk <= as_of,
            or_(
                Mobil.tanggal_terjual.is_(None),
                Mobil.tanggal_terjual > as_of
            ),
            MobilBiayaLainnya.tanggal <= as_of,
            # Exclude category 'Perawatan Bengkel' as it's already in piutang_internal
            MobilBiayaLainnya.kategori != "Perawatan Bengkel"
        )
        total_prep = float(prep_q.scalar() or 0)

        return total_price + total_prep

    def get_fixed_asset_value(self, as_of: date) -> float:
        """Calculate fixed asset value (unrealized acquisition cost) as of date"""
        from app.models.keuangan import Aset
        return float(self.db.query(func.sum(Aset.harga_beli)).filter(
            Aset.tanggal_beli <= as_of,
            Aset.status == AssetStatus.AKTIF
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

