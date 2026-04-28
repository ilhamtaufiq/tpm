import os, sys
sys.path.insert(0, '.')
os.environ.setdefault('DATABASE_URL', 'mysql+pymysql://root:@localhost/tpm')

from datetime import date
from app.database import SessionLocal
from app.services.reports.laba_rugi_service import LabaRugiService
from app.services.reports.modal_service import ModalService
from app.services.reports.neraca_service import NeracaService

db = SessionLocal()
d_from = date(2026, 4, 1)
d_to = date(2026, 4, 28)

lr = LabaRugiService(db).get_report(d_from, d_to)
modal = ModalService(db).get_report(d_from, d_to)
neraca = NeracaService(db).get_report(d_to)

print("=== LABA RUGI ===")
s = lr["summary"]
print("Laba Operasional:", s["laba_operasional"])
print("Prive:", s["prive"])
print("Laba Bersih:", s["laba_bersih"])
print("Beban Umum:", s["total_beban_umum"])
print()

b = lr["units"]["bengkel"]
ja = lr["units"]["jasa_angkut"]
m = lr["units"]["mobil"]
print("Bengkel: revenue=%s, hpp=%s, laba_kotor=%s, gaji=%s, ops=%s, laba_bersih=%s" % (b["revenue"], b["hpp"], b["laba_kotor"], b["beban_gaji"], b["beban_operasional"], b["laba_bersih"]))
print("JA: revenue=%s, ops=%s, maint=%s, umum=%s, laba_bersih=%s" % (ja["revenue"], ja["beban_operasional"], ja["maintenance"], ja["beban_umum"], ja["laba_bersih"]))
print("Mobil: revenue=%s, hpp=%s, prep=%s, maint=%s, sharing=%s, umum=%s, laba_bersih=%s" % (m["revenue"], m["hpp"], m["beban_operasional"], m["maintenance"], m["sharing_investor"], m.get("beban_umum", 0), m["laba_bersih"]))

print()
print("=== NERACA ===")
print("Total Aktiva:", neraca["total_aktiva"])
print("Total Pasiva:", neraca["total_pasiva"])
print("Selisih:", neraca["selisih"])
print("Is Balanced:", neraca["is_balanced"])
nm = neraca["modal"]
print("Modal: setoran=%s, laba_ditahan=%s, prive=%s, total_modal=%s" % (nm["setoran_modal"], nm["laba_ditahan"], nm["prive"], nm["total_modal"]))
cv = neraca["cross_validation"]
print("Cross-val: eq_comp=%s, eq_ident=%s, selisih_eq=%s" % (cv["equity_from_components"], cv["equity_from_identity"], cv["selisih_equity"]))
print("Hutang:", neraca["hutang"])
print()
print("Aktiva detail:")
al = neraca["aktiva_lancar"]
print("  Kas tunai=%s, bank=%s, unit=%s => total_kas=%s" % (al["kas_tunai"], al["kas_bank"], al["unit_cash"], al["total_kas_bank"]))
print("  Piutang total=%s" % al["total_piutang"])
print("  Part=%s, Mobil=%s" % (al["persediaan_sparepart"], al["stok_mobil"]))
print("  Total Aktiva Lancar=%s" % al["total_aktiva_lancar"])
at = neraca["aktiva_tetap"]
print("  Aktiva Tetap=%s" % at["total_aktiva_tetap"])

print()
print("=== PERUBAHAN MODAL ===")
sa = modal["section_a"]
print("Section A: opening=%s, setoran=%s, laba=%s, total_a=%s" % (sa["opening_balance"], sa["setoran_modal"], sa["total_laba"], sa["total_a"]))
det = sa["details"]
print("  laba_bengkel=%s, laba_mobil=%s, laba_ja=%s" % (det["laba_bengkel"], det["laba_kotor_mobil"], det["laba_jasa_angkut"]))
print("Section B: total_b=%s" % modal["section_b"]["total_b"])
sc = modal["section_c"]
print("Section C: total_c=%s" % sc["total_c"])
print("  ops=%s, gaji=%s, lembur=%s, prive=%s, kasbon=%s" % (sc["operasional"], sc["gaji"], sc["lembur"], sc["prive"], sc["kasbon_karyawan"]))
sd = modal["section_d"]
print("Section D: cash=%s, transfer=%s, theoretical=%s, penyesuaian=%s" % (sd["cash"], sd["transfer"], sd["theoretical_modal"], sd["penyesuaian"]))
se = modal["section_e"]
print("Section E: total_e=%s" % se["total_e"])
print("  part=%s, mobil=%s, investor=%s, lainnya=%s" % (se["hutang_part"], se["hutang_mobil"], se["hutang_investor"], se["hutang_lainnya"]))

print()
print("=== CROSS CHECK ===")
lr_ret = s["laba_operasional"]
nr_ret = nm["laba_ditahan"]
print("LR laba_operasional vs Neraca laba_ditahan: %s vs %s => selisih = %s" % (lr_ret, nr_ret, lr_ret - nr_ret))
print("LR laba_bersih vs Neraca (laba_ditahan - prive): %s vs %s" % (s["laba_bersih"], nr_ret - nm["prive"]))

modal_kas = sd["cash"] + sd["transfer"]
neraca_kas = al["total_kas_bank"]
print("Modal kas vs Neraca kas: %s vs %s => selisih = %s" % (modal_kas, neraca_kas, modal_kas - neraca_kas))

modal_hutang = se["total_e"]
neraca_hutang = neraca["hutang"]["total_hutang"]
print("Modal hutang vs Neraca hutang: %s vs %s => selisih = %s" % (modal_hutang, neraca_hutang, modal_hutang - neraca_hutang))

# KEY CHECK: Laba Rugi formula vs base.py retained_earnings
# LR: laba_operasional = b_laba_bersih + ja_laba_bersih + m_laba_bersih - overhead_pusat
lr_formula = b["laba_bersih"] + ja["laba_bersih"] + m["laba_bersih"] - s["total_beban_umum"]
print()
print("LR formula check: b_net(%s) + ja_net(%s) + m_net(%s) - overhead(%s) = %s" % (b["laba_bersih"], ja["laba_bersih"], m["laba_bersih"], s["total_beban_umum"], lr_formula))
print("LR reported laba_operasional: %s" % s["laba_operasional"])
print("Diff: %s" % (lr_formula - s["laba_operasional"]))

db.close()
