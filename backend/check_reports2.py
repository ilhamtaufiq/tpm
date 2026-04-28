import os, sys
sys.path.insert(0, '.')
os.environ.setdefault('DATABASE_URL', 'mysql+pymysql://root:@localhost/tpm')

from datetime import date
from app.database import SessionLocal
from app.services.reports.base import BaseReportService

db = SessionLocal()
d_from = date(2024, 1, 1)
d_to = date(2026, 4, 28)

# This is what Neraca calls
hist = BaseReportService(db).get_unit_financial_breakdown(d_from, d_to)

print("=== BASE.PY get_unit_financial_breakdown (full history) ===")
print("retained_earnings:", hist["retained_earnings"])
print("laba_bersih:", hist["laba_bersih"])
print("prive_global:", hist["prive_global"])
print("total_operasional:", hist["total_operasional"])
print("internal_elimination:", hist["internal_elimination"])
print("admin_fees_unrecorded:", hist.get("admin_fees_unrecorded", 0))
print("ja_untracked_gap:", hist.get("ja_untracked_gap", 0))
print()

b = hist["units"]["bengkel"]
ja = hist["units"]["jasa_angkut"]
m = hist["units"]["mobil"]

print("Bengkel: laba_kotor=%s, gaji=%s, lembur=%s, common=%s, total_expenses=%s" % (
    b["laba_kotor"], b["gaji"], b["lembur"], b["common_expenses"], b["total_expenses"]))
print("JA: revenue_tpm=%s, trip_costs=%s, armada_ops_ledger=%s, overhead=%s, repairs=%s" % (
    ja["revenue_tpm"], ja["trip_costs"], ja["armada_ops_ledger"], ja["overhead"], ja["repairs"]))
print("Mobil: total_laba_kotor=%s, total_laba_tpm=%s, sharing=%s, overhead=%s" % (
    m["total_laba_kotor"], m["total_laba_tpm"], m["sharing_investor"], m["overhead"]))

# Now the SAME thing for the April-only period (what LabaRugi uses)
print()
print("=== BASE.PY (April 2026 only) ===")
hist2 = BaseReportService(db).get_unit_financial_breakdown(date(2026, 4, 1), date(2026, 4, 28))
print("retained_earnings:", hist2["retained_earnings"])
print("laba_bersih:", hist2["laba_bersih"])
print("prive_global:", hist2["prive_global"])
print("total_operasional:", hist2["total_operasional"])
print("internal_elimination:", hist2["internal_elimination"])

b2 = hist2["units"]["bengkel"]
ja2 = hist2["units"]["jasa_angkut"]
m2 = hist2["units"]["mobil"]

print("Bengkel: laba_kotor=%s, gaji=%s, lembur=%s, common=%s, total_expenses=%s" % (
    b2["laba_kotor"], b2["gaji"], b2["lembur"], b2["common_expenses"], b2["total_expenses"]))
print("JA: revenue_tpm=%s, trip_costs=%s, armada_ops_ledger=%s, overhead=%s, repairs=%s" % (
    ja2["revenue_tpm"], ja2["trip_costs"], ja2["armada_ops_ledger"], ja2["overhead"], ja2["repairs"]))
print("Mobil: total_laba_kotor=%s, total_laba_tpm=%s, sharing=%s, overhead=%s" % (
    m2["total_laba_kotor"], m2["total_laba_tpm"], m2["sharing_investor"], m2["overhead"]))

# Breakdown the retained_earnings formula
print()
print("=== RETAINED EARNINGS FORMULA BREAKDOWN ===")
print("--- Full History (what Neraca uses) ---")
laba_mobil_tpm = float(m["total_laba_tpm"])
laba_bengkel_kotor = float(b["laba_kotor"])
laba_ja_tpm = float(ja["revenue_tpm"])
total_laba_gross = laba_mobil_tpm + laba_bengkel_kotor + laba_ja_tpm
print("total_laba_gross = mobil_tpm(%s) + bengkel(%s) + ja(%s) = %s" % (
    laba_mobil_tpm, laba_bengkel_kotor, laba_ja_tpm, total_laba_gross))
print("internal_elimination:", hist["internal_elimination"])
print("total_operasional:", hist["total_operasional"])
print("gaji:", b["gaji"])
print("lembur:", b["lembur"])
ret = total_laba_gross - hist["internal_elimination"] - hist["total_operasional"] - b["gaji"] - b["lembur"]
print("computed retained_earnings = %s - %s - %s - %s - %s = %s" % (
    total_laba_gross, hist["internal_elimination"], hist["total_operasional"], b["gaji"], b["lembur"], ret))
print("stored retained_earnings:", hist["retained_earnings"])

print()
print("--- April Only (what LabaRugi uses) ---")
# LabaRugi formula: b_laba_bersih + ja_laba_bersih + m_laba_bersih - overhead_pusat
# b_laba_bersih = b_laba_kotor - b_gaji - b_ops  
# ja_laba_bersih = ja_revenue_gross - ja_maintenance - ja_ops_final - ja_overhead
# m_laba_bersih = m_revenue - m_hpp_unit - m_maintenance - m_prep - m_overhead - m_sharing

b_laba_kotor_apr = float(hist2["raw_summaries"]["bengkel"]["total_laba_kotor"])
b_gaji_apr = b2["gaji"]
b_ops_apr = b2["total_expenses"]
b_net_apr = b_laba_kotor_apr - b_gaji_apr - b_ops_apr

ja_rev_apr = ja2["revenue_tpm"] + ja2["trip_costs"]
ja_maint_apr = ja2["repairs"]
ja_ops_apr = ja2["trip_costs"] + ja2.get("armada_ops_ledger", 0)
ja_oh_apr = ja2["overhead"]
ja_net_apr = ja_rev_apr - ja_maint_apr - ja_ops_apr - ja_oh_apr

print("LR b_net = %s - %s - %s = %s" % (b_laba_kotor_apr, b_gaji_apr, b_ops_apr, b_net_apr))
print("LR ja_net = %s - %s - %s - %s = %s" % (ja_rev_apr, ja_maint_apr, ja_ops_apr, ja_oh_apr, ja_net_apr))
print("LR m_net = 0 (no sales)")
print("LR overhead = %s" % b2["common_expenses"])
print("LR laba_operasional = %s" % (b_net_apr + ja_net_apr - b2["common_expenses"]))

# Compare: base.py retained_earnings (April) vs LR laba_operasional (April)
print()
print("base.py retained_earnings (April): %s" % hist2["retained_earnings"])
print("LR laba_operasional (April): %s" % (b_net_apr + ja_net_apr - b2["common_expenses"]))
print("Diff: %s" % (hist2["retained_earnings"] - (b_net_apr + ja_net_apr - b2["common_expenses"])))

# Spare part stock sanity check
print()
print("=== SPARE PART STOCK CHECK ===")
from sqlalchemy import func, case
from app.models.bengkel import SparePart
stock_val = float(db.query(
    func.sum(case((SparePart.stok == 999, SparePart.harga_beli), else_=SparePart.stok * SparePart.harga_beli))
).filter(SparePart.deleted_at.is_(None)).scalar() or 0)
print("Current spare part stock value: %s" % stock_val)
count = db.query(func.count(SparePart.id)).filter(SparePart.deleted_at.is_(None)).scalar()
print("Total parts count: %s" % count)
sentinel_count = db.query(func.count(SparePart.id)).filter(SparePart.stok == 999, SparePart.deleted_at.is_(None)).scalar()
print("Sentinel (stok=999) count: %s" % sentinel_count)
sentinel_val = float(db.query(func.sum(SparePart.harga_beli)).filter(SparePart.stok == 999, SparePart.deleted_at.is_(None)).scalar() or 0)
print("Sentinel total value: %s" % sentinel_val)
normal_val = float(db.query(func.sum(SparePart.stok * SparePart.harga_beli)).filter(SparePart.stok != 999, SparePart.deleted_at.is_(None)).scalar() or 0)
print("Normal parts total value (stok*harga): %s" % normal_val)
print("Grand total stock = sentinel(%s) + normal(%s) = %s" % (sentinel_val, normal_val, sentinel_val + normal_val))

db.close()
