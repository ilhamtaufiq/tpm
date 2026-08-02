from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_investor_booking_debt_requires_completed_sale():
    base = read("backend/app/services/reports/base.py")

    assert "unsold_investor_capital" in base
    assert "investor_debt" in base
    assert "TransaksiPenjualanMobil.status_bayar == PaymentStatus.LUNAS" in base
    assert "Mobil.status == CarStatus.TERJUAL" in base
    assert "Mobil.tanggal_terjual <= tanggal_sampai" in base
    assert "Active bookings are not sold yet" in base


def test_laba_rugi_uses_sold_only_mobil_contract():
    base = read("backend/app/services/reports/base.py")
    laba_rugi = read("backend/app/services/reports/laba_rugi_service.py")
    penjualan_mobil = read("backend/app/services/penjualan_mobil_service.py")

    assert '"sales_revenue": sold_revenue' in base
    assert '"purchase_hpp": hpp_sold_price' in base
    assert 'm.get("sales_revenue", 0)' in laba_rugi
    assert 'm.get("purchase_hpp", 0)' in laba_rugi
    assert 'm.get("repairs", 0)' in laba_rugi
    assert "mobil_total_repairs_sold = max(0, workshop_bills + capital_sold_repairs)" in base
    assert "Booking/DP transactions are not realized sales yet" in penjualan_mobil
    assert "defer investor profit until the unit is fully sold" in penjualan_mobil
    assert "_finalize_investor_profit_split" in penjualan_mobil
    assert "TransaksiPenjualanMobil.status_bayar == PaymentStatus.LUNAS" in penjualan_mobil
    assert "Mobil.tanggal_terjual >= tanggal_dari" in penjualan_mobil
    assert '"maintenance": m_maintenance' in laba_rugi
    assert 'data["raw_summaries"]["mobil"].get("total_penjualan"' not in laba_rugi
    assert 'data["raw_summaries"]["mobil"].get("total_harga_beli"' not in laba_rugi
    assert 'data["raw_summaries"]["mobil"].get("total_biaya_bengkel"' not in laba_rugi


def test_frontend_finance_pages_render_investor_booking_lines():
    laba_rugi = read("frontend/app/laporan/laba-rugi.tsx")
    perubahan_modal = read("frontend/app/laporan/perubahan-modal.tsx")
    neraca = read("frontend/app/laporan/neraca.tsx")

    assert "Bagi Hasil Investor" in laba_rugi
    assert "unit.sharing_investor" in laba_rugi
    assert "Laba Bersih Unit" in laba_rugi
    assert "unit.maintenance ?? details.total_biaya_bengkel" in laba_rugi

    assert "investor_funding" in perubahan_modal
    assert "Dana Investor Mobil" in perubahan_modal
    assert "Pembayaran Investor Mobil" in perubahan_modal
    assert "Setoran Modal Kas" in perubahan_modal
    assert "Setoran Modal Non-Kas" in perubahan_modal

    assert "Hutang Investor" in neraca
    assert "h.hutang_investor" in neraca
    assert "Sisa Kewajiban Booking Mobil" in neraca
    assert "h.piutang_booking" in neraca


def test_modal_snapshot_does_not_double_count_booking_liability():
    modal = read("backend/app/services/reports/modal_service.py")
    neraca = read("backend/app/services/reports/neraca_service.py")

    # Investor funding is treated as a liability (not owner capital) so that
    # Perubahan Modal stays aligned with Neraca (both report owner equity).
    assert "kewajiban_usaha = hutang_usaha_total" in modal
    assert "+ piutang_booking" not in modal.split("kewajiban_usaha")[1].split("modal_aktual")[0]
    assert "piutang_booking = 0" in neraca
    assert "uang_muka_penjualan" in neraca


def test_internal_repair_elimination_contract():
    base = read("backend/app/services/reports/base.py")
    laba_rugi = read("backend/app/services/reports/laba_rugi_service.py")
    modal = read("backend/app/services/reports/modal_service.py")
    neraca = read("backend/app/services/reports/neraca_service.py")

    assert '"internal_elimination": internal_elimination' in base
    assert "- overhead_pusat" in laba_rugi
    assert "- overhead_pusat - elimination" not in laba_rugi
    assert '"internal_elimination": elimination' in laba_rugi
    assert "laba_kotor +" in modal
    assert "investor_capital_baru +" in modal
    assert "pembayaran_investor" in modal
    assert '"eliminasi_internal": internal_elimination' in modal
    assert "total_pasiva = total_liabilities + total_modal" in neraca
    assert "report_selisih = total_assets - total_pasiva" in neraca
