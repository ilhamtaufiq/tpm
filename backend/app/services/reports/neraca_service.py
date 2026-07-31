from datetime import date
from decimal import Decimal
from typing import Dict, Any, Optional
from sqlalchemy import func, or_, and_
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
    PaymentStatus,
    WorkshopStatus
)
from app.utils.workshop_finance import (
    internal_mobil_workshop_filters,
    workshop_finance_recognized_filters,
)

class NeracaService(BaseReportService):
    def get_report(self, as_of_date: date) -> Dict[str, Any]:
        """Laporan Neraca (Balance Sheet) as of a specific date."""
        from app.models.mobil import TransaksiPenjualanMobil, Mobil
        from app.models.bengkel import SparePart
        from app.utils.constants import InvestorDisbursementStatus, OwnershipType
        
        # Auto-sync: fix orphaned internal piutang/hutang + JA muatan kas before computing
        self.sync_internal_transactions()
        self.sync_ja_muatan_finance()
        self.sync_ja_internal_bengkel_finance()
        self.sync_mobil_internal_bengkel_finance()
        
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
        
        # Internal Piutang Breakdown (kept for tracing only; not consolidated)
        piutang_internal_total = raw_piutang.get("breakdown", {}).get("internal", 0)
        piutang_part_mobil = raw_piutang.get("breakdown", {}).get("internal_mobil", 0)
        piutang_part_ja = raw_piutang.get("breakdown", {}).get("internal_ja", 0)
        
        # Consolidated neraca excludes all internal receivables. Internal repair
        # value for JB Mobil is already capitalized into Stok Mobil.
        total_piutang = raw_piutang.get("total", 0)
        
        # Assets from consolidated breakdown
        raw_stock_mobil = hist["assets"]["persediaan_mobil"]
        total_stock_mobil_raw = float(raw_stock_mobil.get("total", 0)) if isinstance(raw_stock_mobil, dict) else float(raw_stock_mobil)
        total_stock_mobil = total_stock_mobil_raw
        total_stock_parts = hist["assets"]["persediaan_part"]
        total_fixed_assets = hist["assets"]["tetap"]
        
        # Stok Mobil must reflect the physical capitalized value:
        # harga beli + biaya persiapan + perbaikan bengkel.
        # Internal JB Mobil piutang is excluded from total_piutang above to avoid
        # double-counting the same workshop bill as both Stock and Receivable.
        total_stock_mobil = total_stock_mobil_raw
        
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
        uang_muka_penjualan = raw_hutang.get("breakdown", {}).get("uang_muka_penjualan", 0)
        piutang_booking = raw_hutang.get("breakdown", {}).get("piutang_booking", 0)
        booking_receivable = piutang_booking

        # Booking receivables are only used as an internal neutralizer before a
        # car is actually sold. Do not show them as Mobil receivable or as a
        # separate booking liability in the balance sheet.
        total_piutang = max(0, total_piutang - booking_receivable)
        piutang_mobil = max(0, piutang_mobil - booking_receivable)
        piutang_booking = 0
        total_assets = total_cash + total_piutang + total_stock_mobil + total_stock_parts + total_fixed_assets
        
        # Internal payables are only kept for trace/debug. Consolidated neraca
        # must not count company-to-company unit payables as external liabilities.
        hutang_internal = raw_hutang.get("breakdown", {}).get("internal", 0)

        total_liabilities = (
            hutang_part
            + hutang_mobil
            + hutang_investor
            + hutang_lainnya
            + hutang_ja
            + uang_muka_penjualan
        )

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
        # Internal repair is already recorded as Bengkel profit, so offset it
        # in non-cash capital discovery. Otherwise the same repair is counted
        # again as Setoran Modal Non-Kas.
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
            *workshop_finance_recognized_filters(),
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
        
        # Internal workshop bills for sold cars are already reflected through
        # consolidated profit/HPP. They must not be treated as non-cash capital,
        # otherwise equity is overstated by the internal repair amount.

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
        
        # Non-cash capital = (current assets + sold assets) - recorded cash purchases - recorded hutang purchases
        # For opening balance imports, piutang represents assets funded by owner capital.
        # Include total_piutang so the balance sheet identity holds.
        piutang_discovery = total_piutang
        total_non_kas_assets_historis = (modal_persediaan + akumulasi_hpp_parts) + (modal_stok_mobil + akumulasi_hpp_mobil + akumulasi_hpp_mobil_prep) + modal_aset_tetap + piutang_discovery
        total_purchase_recorded = pembelian_part_kas + pembelian_aset_kas + pembelian_mobil_kas + pembelian_hutang + hutang_internal
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
                "piutang_part_mobil": 0,
                "piutang_jasa_angkut": piutang_ja,
                "piutang_karyawan": piutang_karyawan,
                "piutang_lainnya": piutang_lainnya,
                "total_piutang": total_piutang,
                "persediaan_sparepart": total_stock_parts,
                "stok_mobil": total_stock_mobil,
                "stok_mobil_detail": raw_stock_mobil.get("details", []),
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
                "hutang_jasa_angkut": hutang_ja,
                "uang_muka_penjualan": uang_muka_penjualan,
                "hutang_internal": hutang_internal,
                "piutang_booking": piutang_booking,
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

    def sync_ja_internal_bengkel_finance(self, user_id: Optional[int] = None) -> Dict[str, Any]:
        """Migrate legacy internal JA bengkel kas entries to hutang/piutang bookkeeping.

        Older flows wrote INTERNAL repair as KELUAR from KAS_UNIT_JASA_ANGKUT (dompet bisa
        minus). Phase 2 keeps dompet cash-only and records the obligation as internal debt.
        """
        from app.models.bengkel import TransaksiPenjualanBengkel
        from app.services.transaksi_bengkel_service import TransaksiBengkelService
        from app.services.kas_bank_service import KasBankService
        from app.utils.constants import PaymentMethod

        try:
            deleted_kas = 0
            created_debt = 0
            settled_debt = 0
            bengkel_service = TransaksiBengkelService(self.db)

            legacy_kas = self.db.query(KasBank).filter(
                KasBank.sumber == KasBankSource.JASA_ANGKUT,
                KasBank.tipe == KasBankType.KELUAR,
                KasBank.keterangan.ilike("Biaya Repair Internal via Bengkel:%"),
            ).all()

            affected_refs = {row.nomor_referensi for row in legacy_kas if row.nomor_referensi}

            for ref in affected_refs:
                deleted_kas += self.db.query(KasBank).filter(
                    KasBank.nomor_referensi == ref,
                    or_(
                        KasBank.keterangan.ilike("Biaya Repair Internal via Bengkel:%"),
                        KasBank.keterangan.ilike("Pembayaran (INTERNAL)% bengkel%"),
                        KasBank.keterangan.ilike("Pembayaran (TRANSFER)% bengkel%"),
                    ),
                ).delete(synchronize_session=False)

            internal_trx = self.db.query(TransaksiPenjualanBengkel).filter(
                TransaksiPenjualanBengkel.kategori == "jasa_angkut",
                TransaksiPenjualanBengkel.status_pengerjaan == WorkshopStatus.SELESAI,
                TransaksiPenjualanBengkel.status_bayar != PaymentStatus.BATAL,
                TransaksiPenjualanBengkel.grand_total > 0,
            ).all()

            for trx in internal_trx:
                piutang = self.db.query(PiutangUsaha).filter(
                    PiutangUsaha.nomor_referensi == trx.nomor_transaksi,
                    PiutangUsaha.sumber == PiutangSource.JASA_ANGKUT,
                    PiutangUsaha.is_internal == True,
                    PiutangUsaha.status != PiutangStatus.BATAL,
                ).first()

                if not piutang:
                    debtor_name = trx.nama_customer or f"Armada {trx.nomor_plat}"
                    amount = Decimal(str(trx.grand_total or 0))
                    piutang = PiutangUsaha(
                        nomor_piutang=bengkel_service._generate_nomor_piutang(),
                        tanggal=trx.tanggal,
                        nama_debitur=debtor_name,
                        nominal_piutang=amount,
                        total_dibayar=Decimal("0"),
                        sisa_piutang=amount,
                        status=PiutangStatus.BELUM_LUNAS,
                        sumber=PiutangSource.JASA_ANGKUT,
                        unit=KasBankSource.BENGKEL,
                        is_internal=True,
                        referensi_id=trx.id,
                        nomor_referensi=trx.nomor_transaksi,
                        catatan=f"AUTO-SYNC: Piutang internal JA dari {trx.nomor_transaksi}",
                        created_by=user_id,
                    )
                    self.db.add(piutang)
                    created_debt += 1

                    hutang = self.db.query(HutangUsaha).filter(
                        HutangUsaha.nomor_referensi == trx.nomor_transaksi,
                        HutangUsaha.is_internal == True,
                        HutangUsaha.status != HutangStatus.BATAL,
                    ).first()
                    if not hutang:
                        self.db.add(HutangUsaha(
                            nomor_hutang=bengkel_service._generate_nomor_hutang(),
                            tanggal=trx.tanggal,
                            nama_kreditur="BENGKEL TPM",
                            nominal_hutang=amount,
                            sisa_hutang=amount,
                            total_dibayar=Decimal("0"),
                            status=HutangStatus.BELUM_LUNAS,
                            sumber=HutangSource.LAINNYA,
                            unit=KasBankSource.JASA_ANGKUT,
                            is_internal=True,
                            referensi_id=trx.id,
                            nomor_referensi=trx.nomor_transaksi,
                            catatan=f"AUTO-SYNC: Hutang internal JA dari {trx.nomor_transaksi}",
                            created_by=user_id,
                        ))
                        created_debt += 1

                if trx.metode_bayar != PaymentMethod.INTERNAL:
                    trx.metode_bayar = PaymentMethod.INTERNAL

                if trx.status_bayar == PaymentStatus.LUNAS and (trx.jumlah_bayar or 0) > 0:
                    trx.jumlah_bayar = Decimal("0")
                    trx.status_bayar = PaymentStatus.BELUM_LUNAS

                muatan_lunas = False
                if trx.muatan_id:
                    from app.models.jasa_angkut import MuatanJasaAngkut
                    muatan = self.db.query(MuatanJasaAngkut).filter(
                        MuatanJasaAngkut.id == trx.muatan_id
                    ).first()
                    muatan_lunas = bool(muatan and muatan.status_bayar == PaymentStatus.LUNAS)

                if muatan_lunas:
                    trx.status_bayar = PaymentStatus.LUNAS
                    trx.jumlah_bayar = trx.grand_total
                    bengkel_service.settle_internal_debts_for_transaksi(
                        trx.nomor_transaksi,
                        user_id=user_id,
                        note="AUTO-SYNC: Pelunasan saat muatan sudah lunas",
                    )
                    settled_debt += 1

            rebuild = KasBankService(self.db).rebuild_balances(KasBankJenis.KAS_UNIT_JASA_ANGKUT)

            if deleted_kas or created_debt or settled_debt or rebuild.get("updated", 0):
                self.db.commit()

            return {
                "status": "success",
                "deleted_legacy_internal_kas": deleted_kas,
                "created_debt_pairs": created_debt,
                "settled_debt_pairs": settled_debt,
                "rebuilt_kas_rows": rebuild.get("updated", 0),
                "affected_refs": len(affected_refs),
            }
        except Exception as e:
            self.db.rollback()
            return {"status": "error", "message": str(e)}

    def sync_mobil_internal_bengkel_finance(self, user_id: Optional[int] = None) -> Dict[str, Any]:
        """Migrate legacy internal mobil bengkel flows to hutang/piutang without wallet movement."""
        from app.models.bengkel import TransaksiPenjualanBengkel
        from app.models.mobil import Mobil, TransaksiPenjualanMobil
        from app.services.transaksi_bengkel_service import TransaksiBengkelService
        from app.services.kas_bank_service import KasBankService
        from app.utils.constants import PaymentMethod

        try:
            deleted_kas = self.db.query(KasBank).filter(
                or_(
                    KasBank.keterangan.ilike("Pelunasan Biaya Repair Internal%"),
                    KasBank.keterangan.ilike("Pelunasan Piutang Internal via Penjualan%"),
                    and_(
                        KasBank.sumber == KasBankSource.JUAL_BELI_MOBIL,
                        KasBank.keterangan.ilike("Biaya Repair Internal via Bengkel:%"),
                    ),
                )
            ).delete(synchronize_session=False)

            bengkel_service = TransaksiBengkelService(self.db)
            created_debt = 0
            settled_debt = 0

            internal_trx = self.db.query(TransaksiPenjualanBengkel).filter(
                TransaksiPenjualanBengkel.mobil_id.isnot(None),
                *internal_mobil_workshop_filters(),
            ).all()

            for trx in internal_trx:
                piutang = self.db.query(PiutangUsaha).filter(
                    PiutangUsaha.nomor_referensi == trx.nomor_transaksi,
                    PiutangUsaha.sumber == PiutangSource.JUAL_BELI_MOBIL,
                    PiutangUsaha.is_internal == True,
                    PiutangUsaha.status != PiutangStatus.BATAL,
                ).first()

                amount = Decimal(str(trx.grand_total or 0))
                if not piutang and amount > 0:
                    debtor_name = trx.nama_customer or f"JB MOBIL - {trx.nomor_plat}"
                    self.db.add(PiutangUsaha(
                        nomor_piutang=bengkel_service._generate_nomor_piutang(),
                        tanggal=trx.tanggal,
                        nama_debitur=debtor_name,
                        nominal_piutang=amount,
                        total_dibayar=Decimal("0"),
                        sisa_piutang=amount,
                        status=PiutangStatus.BELUM_LUNAS,
                        sumber=PiutangSource.JUAL_BELI_MOBIL,
                        unit=KasBankSource.BENGKEL,
                        is_internal=True,
                        referensi_id=trx.id,
                        nomor_referensi=trx.nomor_transaksi,
                        catatan=f"AUTO-SYNC: Piutang internal mobil dari {trx.nomor_transaksi}",
                        created_by=user_id,
                    ))
                    created_debt += 1

                    hutang = self.db.query(HutangUsaha).filter(
                        HutangUsaha.nomor_referensi == trx.nomor_transaksi,
                        HutangUsaha.is_internal == True,
                        HutangUsaha.status != HutangStatus.BATAL,
                    ).first()
                    if not hutang:
                        self.db.add(HutangUsaha(
                            nomor_hutang=bengkel_service._generate_nomor_hutang(),
                            tanggal=trx.tanggal,
                            nama_kreditur="BENGKEL TPM",
                            nominal_hutang=amount,
                            sisa_hutang=amount,
                            total_dibayar=Decimal("0"),
                            status=HutangStatus.BELUM_LUNAS,
                            sumber=HutangSource.JUAL_BELI_MOBIL,
                            unit=KasBankSource.JUAL_BELI_MOBIL,
                            is_internal=True,
                            referensi_id=trx.id,
                            nomor_referensi=trx.nomor_transaksi,
                            catatan=f"AUTO-SYNC: Hutang internal mobil dari {trx.nomor_transaksi}",
                            created_by=user_id,
                        ))
                        created_debt += 1

                if trx.metode_bayar not in (PaymentMethod.INTERNAL, PaymentMethod.KREDIT):
                    trx.metode_bayar = PaymentMethod.INTERNAL

                mobil = self.db.query(Mobil).filter(Mobil.id == trx.mobil_id).first()
                sale_lunas = None
                if mobil and mobil.status == CarStatus.TERJUAL:
                    sale_lunas = self.db.query(TransaksiPenjualanMobil).filter(
                        TransaksiPenjualanMobil.mobil_id == mobil.id,
                        TransaksiPenjualanMobil.status_bayar == PaymentStatus.LUNAS,
                    ).first()

                if sale_lunas:
                    trx.status_bayar = PaymentStatus.LUNAS
                    trx.jumlah_bayar = trx.grand_total
                    bengkel_service.settle_internal_debts_for_transaksi(
                        trx.nomor_transaksi,
                        user_id=user_id,
                        note="AUTO-SYNC: Pelunasan saat mobil sudah terjual",
                    )
                    settled_debt += 1

            rebuild_mobil = KasBankService(self.db).rebuild_balances(KasBankJenis.KAS_UNIT_MOBIL)
            rebuild_bengkel = KasBankService(self.db).rebuild_balances(KasBankJenis.KAS_UNIT_BENGKEL)

            if deleted_kas or created_debt or settled_debt or rebuild_mobil.get("updated", 0) or rebuild_bengkel.get("updated", 0):
                self.db.commit()

            return {
                "status": "success",
                "deleted_legacy_internal_kas": deleted_kas,
                "created_debt_pairs": created_debt,
                "settled_debt_pairs": settled_debt,
                "rebuilt_mobil_kas_rows": rebuild_mobil.get("updated", 0),
                "rebuilt_bengkel_kas_rows": rebuild_bengkel.get("updated", 0),
            }
        except Exception as e:
            self.db.rollback()
            return {"status": "error", "message": str(e)}

    def sync_ja_muatan_finance(self) -> Dict[str, Any]:
        """Clean legacy JA operasional kas rows and rebuild unit wallet saldo chain.

        Biaya operasional muatan (tol, dll.) dipotong dari tagihan/piutang — tidak boleh
        punya KasBank KELUAR terpisah. Entri legacy membuat saldo unit JA salah sehingga
        pemasukan sebagian tidak terlihat di neraca.
        """
        from app.services.kas_bank_service import KasBankService

        try:
            deleted = self.db.query(KasBank).filter(
                KasBank.sumber == KasBankSource.JASA_ANGKUT,
                KasBank.tipe == KasBankType.KELUAR,
                KasBank.keterangan.ilike("Biaya Operational Muatan %"),
            ).delete(synchronize_session=False)

            rebuild = KasBankService(self.db).rebuild_balances(KasBankJenis.KAS_UNIT_JASA_ANGKUT)

            if deleted or rebuild.get("updated", 0):
                self.db.commit()

            return {
                "status": "success",
                "deleted_legacy_ops_kas": deleted,
                "rebuilt_kas_rows": rebuild.get("updated", 0),
            }
        except Exception as e:
            self.db.rollback()
            return {"status": "error", "message": str(e)}

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
            from app.models.mobil import Mobil
            from app.services.transaksi_bengkel_service import TransaksiBengkelService

            bengkel_service = TransaksiBengkelService(self.db)
            completed_unpaid = self.db.query(TransaksiPenjualanBengkel).filter(
                TransaksiPenjualanBengkel.grand_total > 0,
                TransaksiPenjualanBengkel.status_bayar != PaymentStatus.LUNAS,
                TransaksiPenjualanBengkel.status_bayar != PaymentStatus.BATAL,
                TransaksiPenjualanBengkel.grand_total > TransaksiPenjualanBengkel.jumlah_bayar,
                TransaksiPenjualanBengkel.kategori != "jasa_angkut",
            ).all()

            for trx in completed_unpaid:
                existing_piutang = self.db.query(PiutangUsaha.id).filter(
                    PiutangUsaha.nomor_referensi == trx.nomor_transaksi,
                    PiutangUsaha.status != PiutangStatus.BATAL,
                ).first()
                if existing_piutang:
                    continue

                outstanding = Decimal(str(trx.grand_total or 0)) - Decimal(str(trx.jumlah_bayar or 0))
                if outstanding <= 0:
                    continue

                is_internal_mobil = trx.kategori == "jual_beli_mobil" and trx.mobil_id is not None
                self.db.add(PiutangUsaha(
                    nomor_piutang=bengkel_service._generate_nomor_piutang(),
                    tanggal=trx.tanggal,
                    customer_id=trx.customer_id,
                    nama_debitur=f"JB MOBIL - {trx.nomor_plat}" if is_internal_mobil else (trx.nama_customer or "Guest"),
                    nominal_piutang=trx.grand_total,
                    total_dibayar=trx.jumlah_bayar or Decimal("0"),
                    sisa_piutang=outstanding,
                    status=PiutangStatus.SEBAGIAN if (trx.jumlah_bayar or 0) > 0 else PiutangStatus.BELUM_LUNAS,
                    sumber=PS.JUAL_BELI_MOBIL if is_internal_mobil else PS.BENGKEL,
                    unit=KasBankSource.BENGKEL,
                    is_internal=is_internal_mobil,
                    referensi_id=trx.id,
                    nomor_referensi=trx.nomor_transaksi,
                    catatan=f"AUTO-SYNC: Piutang transaksi bengkel selesai {trx.nomor_transaksi}",
                ))
                created_count += 1
            
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
            sold_internal_piutang = self.db.query(PiutangUsaha).join(
                TransaksiPenjualanBengkel,
                PiutangUsaha.nomor_referensi == TransaksiPenjualanBengkel.nomor_transaksi
            ).join(
                Mobil,
                TransaksiPenjualanBengkel.mobil_id == Mobil.id
            ).filter(
                PiutangUsaha.is_internal == True,
                PiutangUsaha.sumber == PS.JUAL_BELI_MOBIL,
                PiutangUsaha.status != PiutangStatus.BATAL,
                PiutangUsaha.status != PiutangStatus.LUNAS,
                TransaksiPenjualanBengkel.kategori == 'jual_beli_mobil',
                Mobil.status == CarStatus.TERJUAL,
            ).all()

            for p in sold_internal_piutang:
                p.status = PiutangStatus.LUNAS
                p.total_dibayar = p.nominal_piutang
                p.sisa_piutang = Decimal("0")
                if not p.tanggal_lunas:
                    p.tanggal_lunas = p.tanggal
                p.catatan = (p.catatan or "") + " | AUTO-SYNC: Dilunaskan karena unit mobil sudah terjual"
                fixed_count += 1

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
