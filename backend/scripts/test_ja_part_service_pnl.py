"""Regresi: nota bengkel kategori `jasa_angkut` harus diakui sebagai BIAYA JA
di Laba/Rugi + Perubahan Modal, apa pun status pengerjaannya.

Bug asal: muatan_service memfilter `status_pengerjaan == SELESAI` dan
neraca_service (sync piutang internal JA) memakai filter yang sama. Nota ANTRE
sudah menambah pendapatan Bengkel + memakai stok part, tapi biayanya tidak
pernah muncul di JA -> Laba/Rugi kelebihan -> Modal Akhir Teoritis melampaui
Aktual. Guardrail yang benar: `workshop_finance_recognized_filters()`
(grand_total > 0; hanya BATAL yang dikecualikan).

Jalan: cd backend && python scripts/test_ja_part_service_pnl.py
"""

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.models  # noqa: F401  (register mapper sebelum query)
from app.database.connection import SessionLocal
from app.models.bengkel import TransaksiPenjualanBengkel
from app.services.muatan_service import MuatanService
from app.services.reports.modal_service import ModalService
from app.utils.constants import PaymentStatus, WorkshopStatus
from app.utils.workshop_finance import workshop_finance_recognized_filters

db = SessionLocal()
TANGGAL = date(2026, 9, 14)

# 1. Set revenue Bengkel (base.py) vs set biaya JA (muatan_service) harus sama
#    kecuali filter kategori — kalau tidak, biaya JA nyangkut tanpa penyeimbang.
revenue_rows = {
    r.id for r in db.query(TransaksiPenjualanBengkel).filter(
        *workshop_finance_recognized_filters()
    ).all()
}
ja_expense_rows = {
    r.id for r in db.query(TransaksiPenjualanBengkel).filter(
        TransaksiPenjualanBengkel.kategori == "jasa_angkut",
        *workshop_finance_recognized_filters(),
    ).all()
}
assert ja_expense_rows <= revenue_rows, (
    "Biaya JA harus subset dari set yang diakui di P&L: "
    f"orphan={ja_expense_rows - revenue_rows}"
)

ante = db.query(TransaksiPenjualanBengkel).filter(
    TransaksiPenjualanBengkel.kategori == "jasa_angkut",
    TransaksiPenjualanBengkel.status_pengerjaan.notin_(
        [WorkshopStatus.SELESAI, WorkshopStatus.BATAL]
    ),
    TransaksiPenjualanBengkel.grand_total > 0,
    TransaksiPenjualanBengkel.status_bayar != PaymentStatus.BATAL,
).all()
assert ante, "Butuh nota JA ANTRE/PROSES untuk membuktikan regresi ini."

ringkas = MuatanService(db).get_summary(date(2026, 9, 1), TANGGAL)
per_armada = sum(ringkas["details"]["bengkel_per_armada"].values())
assert abs(ringkas["details"]["biaya_bengkel"] - per_armada) < 1, (
    "biaya_bengkel != jumlah bengkel_per_armada: "
    f'{ringkas["details"]["biaya_bengkel"]} vs {per_armada}'
)
assert per_armada > 0, "Nota JA ANTRE tidak terhitung sebagai biaya JA."

# 2. Sigma drill `laba/rugi per unit` harus = info.laba_bersih (kontrak frontend
#    laporan/perubahan-modal.tsx & dashboard component drills.ts drillLabaPeriode).
modal = ModalService(db).get_report(date(2026, 9, 1), TANGGAL)
u = modal["info"]["units"]
b, m, ja = u["bengkel"], u["mobil"], u["jasa_angkut"]
sigma = (
    float(b.get("laba_kotor", 0)) - float(b.get("total_expenses", 0)) - float(b.get("common_expenses", 0))
    + float(m.get("total_laba_kotor", 0)) - float(m.get("overhead", 0))
    + float(ja.get("revenue_tpm", 0)) - float(ja.get("trip_costs", 0)) - float(ja.get("repairs", 0))
    - float(ja.get("overhead", 0)) - float(ja.get("armada_ops", 0)) - float(ja.get("armada_ops_ledger", 0))
)
assert abs(sigma - modal["info"]["laba_bersih"]) < 1, (
    f'Sigma drill {sigma} != info.laba_bersih {modal["info"]["laba_bersih"]}'
)

# 3. Keseimbangan ekuitas: Aktual-Neraca == Teoritis-Backend.
assert modal["is_balanced"], f'Modal tidak balance: selisih={modal["selisih"]}'

print(f"OK - nota JA diakui Rp{per_armada:,.0f}; "
      f"laba/rugi periode Rp{modal['info']['laba_bersih']:,.0f}; "
      f"selisih Rp{modal['selisih']:,.0f}")
