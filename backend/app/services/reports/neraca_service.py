from datetime import date
from decimal import Decimal
from typing import Dict, Any, Optional
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
    KasBankType,
    PaymentStatus
)

class NeracaService(BaseReportService):
    def get_report(self, as_of_date: date) -> Dict[str, Any]:
        """Laporan Neraca (Balance Sheet) as of a specific date."""
        from app.models.mobil import TransaksiPenjualanMobil, Mobil
        from app.models.bengkel import SparePart
        from app.utils.constants import InvestorDisbursementStatus, OwnershipType
        
        # Auto-sync: fix orphaned internal piutang/hutang before computing
        self.sync_internal_transactions()
        
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
        raw_piutang = hist.get("raw_summaries", {}).get("piutang", {})
        piutang_bengkel = raw_piutang.get("breakdown", {}).get("bengkel", 0)
        piutang_ja = raw_piutang.get("breakdown", {}).get("ja", 0)
        piutang_mobil = raw_piutang.get("breakdown", {}).get("mobil", 0)
        piutang_karyawan = raw_piutang.get("breakdown", {}).get("kasbon", 0)
        piutang_lainnya = raw_piutang.get("breakdown", {}).get("lainnya", 0)
        
        # Internal Piutang Breakdown (Added for internal repair tracking)
        piutang_internal_total = raw_piutang.get("breakdown", {}).get("internal", 0)
        piutang_part_mobil = raw_piutang.get("breakdown", {}).get("internal_mobil", 0)
        piutang_part_ja = raw_piutang.get("breakdown", {}).get("internal_ja", 0)
        
        # Total Piutang now includes internal to balance with internal liabilities
        total_piutang = raw_piutang.get("total", 0) + piutang_internal_total
        
        # Assets from consolidated breakdown
        raw_stock_mobil = hist["assets"]["persediaan_mobil"]
        total_stock_mobil = float(raw_stock_mobil.get("total", 0)) if isinstance(raw_stock_mobil, dict) else float(raw_stock_mobil)
        total_stock_parts = hist["assets"]["persediaan_part"]
        total_fixed_assets = hist["assets"]["tetap"]
        
        # Internal repair costs are kept in Stock value to reflect the asset's true value,
        # while also appearing in 'Piutang Sparepart Mobil' to balance the 'Hutang Internal'.
        # However, because 'internal_elimination' removes the unrealized revenue from Laba Ditahan,
        # we must also subtract it from the Asset value to maintain the Balance Sheet identity.
        total_stock_mobil = float(raw_stock_mobil.get("total", 0)) if isinstance(raw_stock_mobil, dict) else float(raw_stock_mobil)
        internal_elimination = float(hist.get("internal_elimination", 0))
        total_stock_mobil -= internal_elimination
        
        # Re-fetch asset list for details
        assets_list = self.db.query(Aset).filter(
            Aset.tanggal_beli <= as_of_date,
            Aset.status == AssetStatus.AKTIF
        ).all()
        
        total_assets = total_cash + total_piutang + total_stock_mobil + total_stock_parts + total_fixed_assets

        # 2. LIABILITIES - Use values from hist for consistency
        raw_hutang = hist.get("raw_summaries", {}).get("hutang", {})
        hutang_part = raw_hutang.get("breakdown", {}).get("bengkel", 0)
        hutang_mobil = raw_hutang.get("breakdown", {}).get("mobil", 0)
        hutang_investor = raw_hutang.get("breakdown", {}).get("investor", 0)
        hutang_lainnya = raw_hutang.get("breakdown", {}).get("lainnya", 0)
        # Combine JA hutang (Unit JA + Lainnya assigned to JA)
        hutang_ja = raw_hutang.get("breakdown", {}).get("ja", 0)
        
        # Internal payables (Unit debts to Workshop)
        hutang_internal = raw_hutang.get("breakdown", {}).get("internal", 0)
        
        total_liabilities = raw_hutang.get("total", 0)

        # 3. EQUITY & PROFIT — Bottom-Up Component Approach
        # ═══════════════════════════════════════════════════════════════
        # Instead of forcing equity = assets - liabilities (which hides
        # errors), we compute equity from its COMPONENTS bottom-up,
        # then compare against the balance sheet identity to find the
        # real selisih.
        # ═══════════════════════════════════════════════════════════════
        
        # We reuse 'hist' fetched at the start for consistent consolidated profit logic
        prive_total = float(hist.get("prive_global", 0))
        
        # Net Consolidated Profit for the company (now includes gaji deduction from base.py)
        retained_earnings = float(hist.get("retained_earnings", 0))
        
        # Laba bersih (after prive) for cross-validation with Laba Rugi
        laba_bersih = float(hist.get("laba_bersih", retained_earnings - prive_total))
        
        # Modal Setoran Kas (Total cash inflow from MODAL source)
        setoran_modal_kas = float(self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.sumber == KasBankSource.MODAL,
            KasBank.tipe == KasBankType.MASUK,
            KasBank.tanggal <= as_of_date
        ).scalar() or 0)
        
        # Use RAW stock_mobil for modal calculation because internal repairs physically increase asset value.
        # We will offset this increase by adding hutang_internal to total_purchase_recorded so it doesn't inflate Setoran Modal.
        modal_persediaan = total_stock_parts
        modal_stok_mobil = float(raw_stock_mobil.get("total", 0)) if isinstance(raw_stock_mobil, dict) else float(raw_stock_mobil)
        modal_aset_tetap = total_fixed_assets
        
        # ═══════════════════════════════════════════════════════════════
        # MODAL NON-KAS (Auto-balancing for imported/existing assets)
        # ═══════════════════════════════════════════════════════════════
        
        # Accumulate Historical HPP because sold items reduce current inventory
        # If we don't add them back, Setoran Modal Non-Kas will artificially drop on every sale
        from app.models.bengkel import TransaksiPenjualanBengkel, DetailTransaksiSpareParts
        akumulasi_hpp_parts = float(self.db.query(func.sum(DetailTransaksiSpareParts.harga_beli * DetailTransaksiSpareParts.qty)).join(
            TransaksiPenjualanBengkel, DetailTransaksiSpareParts.transaksi_id == TransaksiPenjualanBengkel.id
        ).filter(
            TransaksiPenjualanBengkel.status_bayar != PaymentStatus.BATAL,
            TransaksiPenjualanBengkel.tanggal <= as_of_date
        ).scalar() or 0)
        
        akumulasi_hpp_mobil = float(self.db.query(func.sum(Mobil.harga_beli)).filter(
            Mobil.status == CarStatus.TERJUAL,
            Mobil.tanggal_terjual <= as_of_date
        ).scalar() or 0)
        
        # Pengeluaran perbaikan/prep untuk mobil yang sudah laku (karena ini bagian dari HPP mobil juga)
        from app.models.bengkel import PengeluaranBengkel
        akumulasi_hpp_mobil_prep = float(self.db.query(func.sum(PengeluaranBengkel.jumlah)).join(Mobil).filter(
            PengeluaranBengkel.bisnis_kategori.in_(["mobil", "jual_beli_mobil", "penjualan_mobil"]),
            Mobil.status == CarStatus.TERJUAL,
            Mobil.tanggal_terjual <= as_of_date,
            PengeluaranBengkel.tanggal <= as_of_date
        ).scalar() or 0)
        
        # Internal workshop bills for sold cars (TransaksiPenjualanBengkel, NOT PengeluaranBengkel).
        # When unsold, these are captured in car_stock via snapshot_unsold_repairs_int (base.py).
        # When sold, they disappear from car_stock but still represent real HPP that was part of the car's value.
        from app.models.bengkel import TransaksiPenjualanBengkel
        akumulasi_hpp_mobil_internal = float(self.db.query(func.sum(TransaksiPenjualanBengkel.grand_total)).join(
            Mobil, TransaksiPenjualanBengkel.mobil_id == Mobil.id
        ).filter(
            TransaksiPenjualanBengkel.kategori.in_(['jual_beli_mobil', 'mobil', 'penjualan_mobil']),
            TransaksiPenjualanBengkel.status_bayar != PaymentStatus.BATAL,
            Mobil.status == CarStatus.TERJUAL,
            Mobil.tanggal_terjual <= as_of_date,
            TransaksiPenjualanBengkel.tanggal <= as_of_date
        ).scalar() or 0)

        # Total pengeluaran kas untuk pembelian aset (part purchases + asset purchases)
        from app.models.bengkel import PembelianSparePart
        pembelian_part_kas = float(self.db.query(func.sum(PembelianSparePart.grand_total)).filter(
            PembelianSparePart.tanggal <= as_of_date
        ).scalar() or 0)
        
        # Aset tetap yang dibeli via KasBank (pengeluaran untuk beli aset)
        pembelian_aset_kas = float(self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.tipe == KasBankType.KELUAR,
            KasBank.sumber == KasBankSource.ASET,
            KasBank.referensi_id.is_not(None),
            KasBank.tanggal <= as_of_date
        ).scalar() or 0)
        
        # Pembelian mobil via KasBank
        pembelian_mobil_kas = float(self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.tipe == KasBankType.KELUAR,
            KasBank.sumber.in_([KasBankSource.PEMBELIAN_MOBIL, KasBankSource.JUAL_BELI_MOBIL]),
            ~KasBank.keterangan.ilike("Transfer %"),
            ~KasBank.keterangan.ilike("%Pelunasan Biaya Repair Internal%"),
            ~KasBank.keterangan.ilike("%Pencairan Investor%"),
            KasBank.tanggal <= as_of_date
        ).scalar() or 0)
        # Hutang yang terbentuk untuk pembelian aset (Mobil)
        # Note: Pembelian_part_kas menggunakan grand_total yang sudah mencakup cash & hutang,
        # jadi kita tidak perlu menambahkan HutangSource.PEMBELIAN_PART lagi.
        from app.models.keuangan import HutangUsaha
        from app.utils.constants import HutangSource
        pembelian_hutang = float(self.db.query(func.sum(HutangUsaha.nominal_hutang)).filter(
            HutangUsaha.sumber == HutangSource.PEMBELIAN_MOBIL,
            HutangUsaha.tanggal <= as_of_date
        ).scalar() or 0)
        
        # Pelunasan internal repair cash-out (offset for akumulasi_hpp_mobil_internal).
        # When a sold car's internal workshop bill is settled, a KasBank KELUAR entry is created
        # with keterangan "Pelunasan Biaya Repair Internal". This cash-out is excluded from
        # pembelian_mobil_kas to avoid double-counting, but must be captured here to offset
        # the akumulasi_hpp_mobil_internal we added to total_non_kas_assets_historis.
        pelunasan_repair_internal_kas = float(self.db.query(func.sum(KasBank.nominal)).filter(
            KasBank.tipe == KasBankType.KELUAR,
            KasBank.sumber == KasBankSource.JUAL_BELI_MOBIL,
            KasBank.keterangan.ilike("%Pelunasan Biaya Repair Internal%"),
            KasBank.tanggal <= as_of_date
        ).scalar() or 0)
        
        # Non-cash capital = (current assets + sold assets) - recorded cash purchases - recorded hutang purchases
        # Note: We include non-revenue piutang (Lainnya & Kasbon) in discovery to account for injected receivables.
        # We EXCLUDE unit-specific piutang (Bengkel, JA, Mobil) as they are typically from revenue and already in Laba Ditahan.
        piutang_discovery = piutang_karyawan + piutang_lainnya
        total_non_kas_assets_historis = (modal_persediaan + akumulasi_hpp_parts) + (modal_stok_mobil + akumulasi_hpp_mobil + akumulasi_hpp_mobil_prep + akumulasi_hpp_mobil_internal) + modal_aset_tetap + piutang_discovery
        total_purchase_recorded = pembelian_part_kas + pembelian_aset_kas + pembelian_mobil_kas + pembelian_hutang + hutang_internal + pelunasan_repair_internal_kas
        modal_non_kas = max(0, total_non_kas_assets_historis - total_purchase_recorded)
        
        # Combined setoran modal = kas setoran + non-kas (auto-balanced)
        setoran_modal = setoran_modal_kas + modal_non_kas
        
        # ═══════════════════════════════════════════════════════════════
        # BOTTOM-UP EQUITY: Compute from components
        # Formula: Setoran Modal (Kas + Non-Kas) + Laba Ditahan - Prive
        # This MUST match (Assets - Liabilities) if accounting is correct
        # ═══════════════════════════════════════════════════════════════
        equity_from_components = setoran_modal + retained_earnings - prive_total
        
        # IDENTITY-BASED EQUITY: From balance sheet identity
        equity_from_identity = total_assets - total_liabilities
        
        # The REAL selisih: difference between bottom-up and identity approaches
        # If accounting is perfect, this should be 0
        selisih_modal = equity_from_components - equity_from_identity
        
        # Use bottom-up equity as total_modal (transparent, not forced)
        total_modal = equity_from_components
        
        # Total Pasiva uses bottom-up equity (may NOT equal total_aktiva if there's an error)
        total_pasiva = total_liabilities + total_modal
        
        # Balance check: compare total aktiva vs total pasiva (bottom-up)
        report_selisih = total_assets - total_pasiva
        # ═══════════════════════════════════════════════════════════════
        # 4. INTERNAL TRACING (FIND DISCREPANCIES)
        # ═══════════════════════════════════════════════════════════════
        internal_mismatches = []
        
        # Get all internal piutang & hutang to find the gaps
        all_int_piutang = self.db.query(PiutangUsaha).filter(
            PiutangUsaha.is_internal == True,
            PiutangUsaha.tanggal <= as_of_date,
            PiutangUsaha.status != PiutangStatus.BATAL
        ).all()
        
        all_int_hutang = self.db.query(HutangUsaha).filter(
            HutangUsaha.is_internal == True,
            HutangUsaha.tanggal <= as_of_date,
            HutangUsaha.status != HutangStatus.BATAL
        ).all()
        
        # Map them by reference for comparison
        piutang_map = {}
        for p in all_int_piutang:
            key = (p.nomor_referensi or f"REF-{p.referensi_id}") if p.referensi_id else p.nomor_piutang
            piutang_map[key] = piutang_map.get(key, 0) + float(p.sisa_piutang)
            
        hutang_map = {}
        for h in all_int_hutang:
            key = (h.nomor_referensi or f"REF-{h.referensi_id}") if h.referensi_id else h.nomor_hutang
            hutang_map[key] = hutang_map.get(key, 0) + float(h.sisa_hutang)
            
        # Find mismatches
        all_keys = set(list(piutang_map.keys()) + list(hutang_map.keys()))
        for key in all_keys:
            p_val = piutang_map.get(key, 0)
            h_val = hutang_map.get(key, 0)
            if abs(p_val - h_val) > 0.1:
                internal_mismatches.append({
                    "ref": key,
                    "piutang": p_val,
                    "hutang": h_val,
                    "gap": p_val - h_val
                })
        
        # Sort by largest gap and limit
        internal_mismatches.sort(key=lambda x: abs(x["gap"]), reverse=True)
        internal_mismatches = internal_mismatches[:10]

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
                "piutang_part_mobil": piutang_part_mobil,
                "piutang_jasa_angkut": piutang_ja + piutang_part_ja,
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
                "setoran_modal_kas": setoran_modal_kas,
                "modal_non_kas": modal_non_kas,
                "setoran_modal": setoran_modal,
                "laba_ditahan": retained_earnings,
                "prive": prive_total,
                "modal_persediaan": modal_persediaan,
                "modal_stok_mobil": modal_stok_mobil,
                "modal_aset_tetap": modal_aset_tetap,
                "selisih_modal": selisih_modal,
                "modal_komponen": equity_from_components,
                "equity_identity": equity_from_identity,
                "total_modal": total_modal
            },
            "total_pasiva": total_pasiva,
            "selisih": report_selisih,
            "is_balanced": is_balanced,
            "cross_validation": {
                "laba_bersih_from_base": laba_bersih,
                "retained_earnings": retained_earnings,
                "prive": prive_total,
                "equity_from_components": equity_from_components,
                "equity_from_identity": equity_from_identity,
                "selisih_equity": selisih_modal,
                "kas_total": total_cash,
                "modal_non_kas": modal_non_kas,
                "piutang_internal": piutang_internal_total,
                "hutang_internal": hutang_internal,
                "selisih_internal": piutang_internal_total - hutang_internal,
                "mismatches": internal_mismatches
            },
            "info": {
                "units": hist.get("units")
            }
        }

    def sync_internal_transactions(self, user_id: Optional[int] = None) -> Dict[str, Any]:
        """Automatically fix internal transaction discrepancies (bidirectional).
        
        Piutang (Workshop/Bengkel) is the SOURCE OF TRUTH.
        Phase 0: Fix piutang with sumber=JUAL_BELI_MOBIL that should be is_internal=True
        Phase 1: Build lookup maps
        Phase 2: Orphaned Piutang (no matching Hutang) → create Hutang
        Phase 3: Orphaned Hutang (no matching Piutang) → try fix piutang flag, else void Hutang
        Phase 4: Mismatched amounts → align Hutang to Piutang
        """
        try:
            fixed_count = 0
            created_count = 0
            voided_count = 0
            reflagged_count = 0

            # ── PHASE 0: Fix mis-flagged piutang ──
            # Piutang from bengkel repair on mobil (sumber=JUAL_BELI_MOBIL) should always be is_internal=True
            from app.utils.constants import PiutangSource as PS
            from app.models.bengkel import TransaksiPenjualanBengkel
            
            mismarked = self.db.query(PiutangUsaha).filter(
                PiutangUsaha.sumber == PS.JUAL_BELI_MOBIL,
                PiutangUsaha.is_internal == False,
                PiutangUsaha.status != PiutangStatus.BATAL
            ).all()
            
            for p in mismarked:
                # Verify it's from a bengkel transaction with kategori=jual_beli_mobil
                if p.nomor_referensi:
                    trx = self.db.query(TransaksiPenjualanBengkel).filter(
                        TransaksiPenjualanBengkel.nomor_transaksi == p.nomor_referensi,
                        TransaksiPenjualanBengkel.kategori == 'jual_beli_mobil'
                    ).first()
                    if trx:
                        p.is_internal = True
                        reflagged_count += 1

            # ── PHASE 1: Find all active internal records ──
            # Re-query after Phase 0 fixes
            self.db.flush()
            
            all_int_piutang = self.db.query(PiutangUsaha).filter(
                PiutangUsaha.is_internal == True,
                PiutangUsaha.status != PiutangStatus.BATAL
            ).all()
            
            all_int_hutang = self.db.query(HutangUsaha).filter(
                HutangUsaha.is_internal == True,
                HutangUsaha.status != HutangStatus.BATAL
            ).all()

            # Build lookup maps
            hutang_by_ref = {}
            hutang_by_txid = {}
            for h in all_int_hutang:
                if h.nomor_referensi:
                    hutang_by_ref[h.nomor_referensi] = h
                if h.referensi_id:
                    hutang_by_txid[h.referensi_id] = h

            piutang_by_ref = {}
            piutang_by_txid = {}
            for p in all_int_piutang:
                if p.nomor_referensi:
                    piutang_by_ref[p.nomor_referensi] = p
                if p.referensi_id:
                    piutang_by_txid[p.referensi_id] = p

            # ── PHASE 2: Orphaned Piutang → create missing Hutang ──
            for p in all_int_piutang:
                h = None
                if p.nomor_referensi:
                    h = hutang_by_ref.get(p.nomor_referensi)
                if not h and p.referensi_id:
                    h = hutang_by_txid.get(p.referensi_id)

                if not h:
                    # Skip creation if piutang is already settled and hutang doesn't exist.
                    # No need to create a 0-balance hutang.
                    if float(p.sisa_piutang or 0) < 0.1:
                        continue
                        
                    sync_no = f"SYNC-P{p.id}"
                    exists = self.db.query(HutangUsaha).filter(HutangUsaha.nomor_hutang == sync_no).first()
                    if exists:
                        continue

                    if p.sumber == PS.JUAL_BELI_MOBIL:
                        hutang_sumber = HutangSource.JUAL_BELI_MOBIL
                        hutang_unit = KasBankSource.JUAL_BELI_MOBIL
                    elif p.sumber == PS.JASA_ANGKUT:
                        hutang_sumber = HutangSource.LAINNYA
                        hutang_unit = KasBankSource.JASA_ANGKUT
                    else:
                        hutang_sumber = HutangSource.JUAL_BELI_MOBIL
                        hutang_unit = KasBankSource.JUAL_BELI_MOBIL

                    new_h = HutangUsaha(
                        nomor_hutang=sync_no,
                        tanggal=p.tanggal,
                        nama_kreditur="BENGKEL TPM",
                        nominal_hutang=p.nominal_piutang or Decimal("0"),
                        sisa_hutang=p.sisa_piutang or Decimal("0"),
                        total_dibayar=p.total_dibayar or Decimal("0"),
                        status=HutangStatus.BELUM_LUNAS if p.status == PiutangStatus.BELUM_LUNAS else HutangStatus.LUNAS,
                        sumber=hutang_sumber,
                        unit=hutang_unit,
                        is_internal=True,
                        referensi_id=p.referensi_id,
                        nomor_referensi=p.nomor_referensi or p.nomor_piutang,
                        catatan=f"AUTO-SYNC: Hutang Internal dari Piutang {p.nomor_piutang}",
                        created_by=user_id
                    )
                    self.db.add(new_h)
                    created_count += 1
                else:
                    # Amount mismatch → align hutang to piutang
                    p_nominal = Decimal(str(p.nominal_piutang or 0))
                    h_nominal = Decimal(str(h.nominal_hutang or 0))
                    p_sisa = Decimal(str(p.sisa_piutang or 0))
                    h_sisa = Decimal(str(h.sisa_hutang or 0))

                    if abs(h_nominal - p_nominal) > Decimal("0.1") or abs(h_sisa - p_sisa) > Decimal("0.1"):
                        h.nominal_hutang = p.nominal_piutang
                        h.sisa_hutang = p.sisa_piutang
                        h.total_dibayar = p.total_dibayar
                        if p.status == PiutangStatus.LUNAS:
                            h.status = HutangStatus.LUNAS
                        elif p.status == PiutangStatus.BELUM_LUNAS:
                            h.status = HutangStatus.BELUM_LUNAS
                        fixed_count += 1

            # ── PHASE 3: Orphaned Hutang → try fix piutang flag, else void ──
            for h in all_int_hutang:
                if h.status == HutangStatus.BATAL:
                    continue

                # Check if already matched by piutang lookup
                p = None
                if h.nomor_referensi:
                    p = piutang_by_ref.get(h.nomor_referensi)
                if not p and h.referensi_id:
                    p = piutang_by_txid.get(h.referensi_id)

                if not p:
                    # Last resort: check if piutang exists with is_internal=False
                    rescue_p = None
                    if h.nomor_referensi:
                        rescue_p = self.db.query(PiutangUsaha).filter(
                            PiutangUsaha.nomor_referensi == h.nomor_referensi,
                            PiutangUsaha.is_internal == False,
                            PiutangUsaha.status != PiutangStatus.BATAL
                        ).first()
                    if not rescue_p and h.referensi_id:
                        rescue_p = self.db.query(PiutangUsaha).filter(
                            PiutangUsaha.referensi_id == h.referensi_id,
                            PiutangUsaha.is_internal == False,
                            PiutangUsaha.status != PiutangStatus.BATAL
                        ).first()

                    if rescue_p:
                        # Fix: mark piutang as internal
                        rescue_p.is_internal = True
                        reflagged_count += 1
                    else:
                        # Truly orphaned → void hutang
                        h.status = HutangStatus.BATAL
                        h.catatan = (h.catatan or "") + " | AUTO-VOIDED: No matching piutang"
                        voided_count += 1

            self.db.commit()
            return {
                "status": "success",
                "fixed": fixed_count,
                "created": created_count,
                "voided": voided_count,
                "reflagged": reflagged_count,
                "message": f"Sync: {reflagged_count} piutang di-reflag, {created_count} hutang dibuat, {fixed_count} diperbaiki, {voided_count} hutang orphan di-void."
            }
        except Exception as e:
            self.db.rollback()
            return {
                "status": "error",
                "message": f"Database error detail: {str(e)}"
            }

