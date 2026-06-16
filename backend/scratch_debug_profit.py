
import os
import sys
from decimal import Decimal
from datetime import date

# Setup path to include backend
sys.path.append(os.path.abspath(os.path.join(os.getcwd(), 'backend')))

from app.database.connection import SessionLocal
from app.services.reports.laba_rugi_service import LabaRugiService
from app.services.reports.base import BaseReportService
from app.api.v1.dashboard import get_dashboard_summary
from app.api.deps import CurrentUser

db = SessionLocal()
try:
    # Set period to current month match what user sees
    today = date.today()
    start = date(today.year, today.month, 1)
    end = today

    print(f"--- DEBUG REPORT (Period: {start} - {end}) ---")

    # 1. Dashboard Logic (Finance Screen)
    from app.services.transaksi_bengkel_service import TransaksiBengkelService
    from app.services.pengeluaran_service import PengeluaranService
    from app.services.penjualan_mobil_service import PenjualanMobilService
    from app.services.muatan_service import MuatanService
    from app.services.slip_gaji_service import SlipGajiService

    b_sum = TransaksiBengkelService(db).get_summary(start, end)
    p_sum = PengeluaranService(db).get_summary(start, end)
    m_sum = PenjualanMobilService(db).get_summary(start, end)
    ja_sum = MuatanService(db).get_summary(start, end)
    g_sum = SlipGajiService(db).get_summary_by_date_range(start, end)

    laba_bengkel_dash = float(b_sum["total_laba_kotor"])
    laba_mobil_dash = float(m_sum["laba_tpm"])
    laba_ja_dash = float(ja_sum["laba_tpm"])
    out_global_dash = float(p_sum["total_pengeluaran"]) + float(g_sum["total"])

    total_dash = laba_bengkel_dash + laba_mobil_dash + laba_ja_dash - out_global_dash

    print(f"\n[DASHBOARD/FINANCE]")
    print(f"Laba Bengkel: {laba_bengkel_dash:,.2f}")
    print(f"Laba Mobil  : {laba_mobil_dash:,.2f}")
    print(f"Laba JA     : {laba_ja_dash:,.2f}")
    print(f"Pengeluaran : {out_global_dash:,.2f}")
    print(f"TOTAL DASH  : {total_dash:,.2f}")

    # 2. Laba Rugi Logic
    lr_service = LabaRugiService(db)
    lr_data = lr_service.get_report(start, end)
    
    print(f"\n[LABA RUGI]")
    print(f"Laba Bengkel: {lr_data['units']['bengkel']['laba_bersih']:,.2f}")
    print(f"Laba Mobil  : {lr_data['units']['mobil']['laba_bersih']:,.2f}")
    print(f"Laba JA     : {lr_data['units']['jasa_angkut']['laba_bersih']:,.2f}")
    print(f"Overhead Pst: {lr_data['summary']['total_beban_umum']:,.2f}")
    print(f"TOTAL LR    : {lr_data['summary']['laba_operasional']:,.2f}")

    # Identify discrepancy
    diff = total_dash - lr_data['summary']['laba_operasional']
    print(f"\nDISCREPANCY: {diff:,.2f}")

finally:
    db.close()
