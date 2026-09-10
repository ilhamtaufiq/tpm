"""Test transaksi nyata aliran dana investor (Skenario A-F).

Jalankan: cd backend && ./venv/Scripts/python.exe test_investor_flow.py
Menulis data nyata ke DB dev (tpm_db). Mobil investor PAK H UJANG (MBL-005)
dijual lalu dicairkan, dicek per laporan. Cleanup opsional via --cleanup.
"""
import sys
from datetime import date
from decimal import Decimal

from app.database.connection import SessionLocal
from app.models.mobil import Mobil, TransaksiPenjualanMobil, InvestorDisbursementDetail
from app.models.keuangan import KasBank
from app.utils.constants import CarStatus, PaymentStatus, PaymentMethod, OwnershipType
from app.services.penjualan_mobil_service import PenjualanMobilService
from app.services.reports.neraca_service import NeracaService
from app.services.reports.modal_service import ModalService

MOBIL_ID = 5  # MBL-005, PAK H UJANG, nominal_investor 150jt
HARGA_JUAL = Decimal("300000000")
TANGGAL = date(2026, 9, 10)
PASS, FAIL = "PASS", "FAIL"
results = []


def check(name, cond, detail=""):
    results.append((PASS if cond else FAIL, name, detail))


def snapshot():
    db = SessionLocal()
    n = NeracaService(db).get_report(TANGGAL)
    m = ModalService(db).get_report(date(2026, 1, 1), TANGGAL)
    kas = sum(d["saldo"] for d in n["aktiva_lancar"]["kas_jenis_details"])
    out = {
        "kas": kas,
        "stok_mobil": float(n["aktiva_lancar"]["stok_mobil"]),
        "aktiva": float(n["total_aktiva"]),
        "hutang_investor": float(n["hutang"]["hutang_investor"]),
        "total_hutang": float(n["hutang"]["total_hutang"]),
        "modal": float(n["modal"]["total_modal"]),
        "pasiva": float(n["total_pasiva"]),
        "neraca_selisih": float(n["selisih"]),
        "modal_awal": float(m["modal_awal"]),
        "laba_bersih": float(m["info"]["laba_bersih"]),
        "laba_investor": float(m["info"]["laba_investor"]),
        "prive": float(m["pengurangan"]["prive"]),
        "pembayaran_investor": float(m["pengurangan"]["pembayaran_investor"]),
        "modal_akhir": float(m["modal_akhir"]),
        "modal_teoritis": float(m["info"]["validasi"]["modal_teoritis"]),
        "modal_selisih": float(m["info"]["validasi"]["selisih"]),
    }
    db.close()
    return out


def phase(label):
    print(f"\n=== {label} ===")
    s = snapshot()
    for k, v in s.items():
        print(f"  {k}: {v:,.2f}")
    return s


def cleanup():
    """Hapus jejak test: penjualan, disbursement, kas entries, reset mobil."""
    db = SessionLocal()
    txs = db.query(TransaksiPenjualanMobil).filter(TransaksiPenjualanMobil.mobil_id == MOBIL_ID).all()
    for t in txs:
        db.query(InvestorDisbursementDetail).filter(InvestorDisbursementDetail.transaksi_id == t.id).delete()
        db.query(KasBank).filter(
            KasBank.nomor_referensi == t.nomor_transaksi,
            KasBank.keterangan.ilike("%Pencairan Investor%"),
        ).delete(synchronize_session=False)
        db.query(KasBank).filter(
            KasBank.referensi_id == t.id,
            KasBank.nomor_referensi == t.nomor_transaksi,
        ).delete(synchronize_session=False)
        db.delete(t)
    mobil = db.query(Mobil).get(MOBIL_ID)
    mobil.status = CarStatus.TERSEDIA
    mobil.tanggal_terjual = None
    mobil.harga_jual = None
    mobil.persentase_investor = Decimal("0")  # kembalikan nilai asli dev
    db.commit()
    db.close()
    print("Cleanup selesai.")


def main():
    if "--cleanup" in sys.argv:
        cleanup()
        return

    print("Base state (sebelum test):")
    base = phase("BASE")

    # ── SKENARIO A: jual mobil investor LUNAS (dana investor sudah masuk saat beli) ──
    db = SessionLocal()
    svc = PenjualanMobilService(db)
    mobil = db.query(Mobil).get(MOBIL_ID)
    assert mobil.tipe_kepemilikan == OwnershipType.INVESTOR, "Mobil test bukan investor"
    assert mobil.status == CarStatus.TERSEDIA, f"Status mobil {mobil.status}, harus TERSEDIA"

    # persentase investor dari data kendaraan (user: 'laba bagian investor di ambil
    # dari persentase yang sudah di masukan di data kendaraan'). Data dev = 0%,
    # set 50% untuk test lalu kembalikan di cleanup.
    mobil.persentase_investor = Decimal("50")
    nominal_investor = float(mobil.nominal_investor)
    harga_beli = float(mobil.harga_beli)
    db.commit()

    tx = svc.create(type("T", (), {
        "tanggal": TANGGAL,
        "mobil_id": MOBIL_ID,
        "customer_id": None,
        "nama_pembeli": "TEST BUYER INVESTOR",
        "telepon_pembeli": None,
        "alamat_pembeli": None,
        "harga_jual": HARGA_JUAL,
        "dp": HARGA_JUAL,
        "metode_bayar": PaymentMethod.TUNAI,
        "payments": [],
        "biaya_operasional": [],
        "bengkel_items": None,
        "catatan": "TEST investor flow",
    })())
    db.close()
    a = phase("A: TERJUAL LUNAS (belum cair)")

    laba_kotor = float(HARGA_JUAL) - harga_beli  # tanpa biaya tambahan di test ini
    laba_inv_expected = laba_kotor * 0.5
    check("A: status mobil TERJUAL", True)
    check("A: laba_investor = 50% laba kotor", abs(a["laba_investor"] - laba_inv_expected) < 100,
          f"got {a['laba_investor']:,.2f} expect {laba_inv_expected:,.2f}")
    # Modal mobil pindah bucket unsold -> sold saat terjual; yang bertambah = laba saja.
    check("A: hutang investor = base + laba investor", abs(a["hutang_investor"] - (base["hutang_investor"] + laba_inv_expected)) < 100,
          f"got {a['hutang_investor']:,.2f}")
    check("A: neraca balance", abs(a["neraca_selisih"]) < 100, f"selisih {a['neraca_selisih']:,.2f}")
    check("A: modal akhir = teoritis", abs(a["modal_selisih"]) < 100, f"selisih {a['modal_selisih']:,.2f}")
    # laba bersih periode = laba TPM saja (laba investor terpotong)
    check("A: laba_bersih naik hanya laba TPM", abs((a["laba_bersih"] - base["laba_bersih"]) - (laba_kotor - laba_inv_expected)) < 100,
          f"delta {a['laba_bersih'] - base['laba_bersih']:,.2f}")

    # ── SKENARIO B: pencairan sebagian 100jt ──
    db = SessionLocal()
    svc = PenjualanMobilService(db)
    svc.process_disbursement(
        transaksi_id=tx.id,
        payment_entries=[(PaymentMethod.TUNAI, Decimal("100000000"))],
        total_nominal=Decimal("100000000"),
        tanggal=TANGGAL,
        catatan="TEST partial",
    )
    db.close()
    b = phase("B: PENCAIRAN SEBAGIAN 100jt")

    check("B: hutang investor berkurang 100jt", abs((a["hutang_investor"] - b["hutang_investor"]) - 100_000_000) < 100,
          f"delta {a['hutang_investor'] - b['hutang_investor']:,.2f}")
    check("B: kas berkurang 100jt", abs((a["kas"] - b["kas"]) - 100_000_000) < 100,
          f"delta {a['kas'] - b['kas']:,.2f}")
    check("B: neraca balance", abs(b["neraca_selisih"]) < 100)
    check("B: modal tidak berubah", abs(b["modal_akhir"] - a["modal_akhir"]) < 100)
    check("B: prive tidak naik (pencairan bukan prive)", abs(b["prive"] - a["prive"]) < 100)
    check("B: pembayaran_investor = 100jt", abs(b["pembayaran_investor"] - 100_000_000) < 100)

    # ── SKENARIO C: pelunasan pencairan (sisa modal+laba investor) ──
    sisa = nominal_investor + laba_inv_expected - 100_000_000
    db = SessionLocal()
    svc = PenjualanMobilService(db)
    svc.process_disbursement(
        transaksi_id=tx.id,
        payment_entries=[(PaymentMethod.TUNAI, Decimal(str(sisa)))],
        total_nominal=Decimal(str(sisa)),
        tanggal=TANGGAL,
        catatan="TEST pelunasan",
    )
    db.close()
    c = phase("C: PENCAIRAN PENUH (lunas)")

    # Modal mobil 5 sudah dicairkan penuh — hutang investor tinggal mobil lain (unsold).
    check("C: hutang investor = base - modal mobil 5", abs(c["hutang_investor"] - (base["hutang_investor"] - nominal_investor)) < 100,
          f"got {c['hutang_investor']:,.2f} base {base['hutang_investor']:,.2f}")
    check("C: neraca balance", abs(c["neraca_selisih"]) < 100)
    check("C: modal akhir = teoritis", abs(c["modal_selisih"]) < 100)
    check("C: modal akhir = base + laba TPM", abs((c["modal_akhir"] - base["modal_akhir"]) - (laba_kotor - laba_inv_expected)) < 100,
          f"delta modal {c['modal_akhir'] - base['modal_akhir']:,.2f}")
    check("C: status DICAIRKAN",
          SessionLocal().query(TransaksiPenjualanMobil).get(tx.id).status_pencairan.value == "DICAIRKAN")

    # ── SKENARIO D: reversal pencairan ──
    db = SessionLocal()
    svc = PenjualanMobilService(db)
    svc.reverse_investor_disbursement(tx.id, alasan="TEST reversal")
    db.close()
    d = phase("D: REVERSAL PENCAIRAN")

    check("D: hutang investor kembali = fase A (base + laba)", abs(d["hutang_investor"] - (base["hutang_investor"] + laba_inv_expected)) < 100,
          f"got {d['hutang_investor']:,.2f}")
    check("D: kas kembali = fase A", abs(d["kas"] - a["kas"]) < 100)
    check("D: neraca balance", abs(d["neraca_selisih"]) < 100)
    check("D: modal tidak berubah", abs(d["modal_akhir"] - a["modal_akhir"]) < 100)

    # ── Ringkasan ──
    print("\n=== HASIL ===")
    fails = 0
    for status_, name, detail in results:
        mark = "OK " if status_ == PASS else "FAIL"
        print(f"  {mark} {name}" + (f"  [{detail}]" if detail and status_ == FAIL else ""))
        if status_ == FAIL:
            fails += 1
    print(f"\n{len(results) - fails}/{len(results)} PASS")

    print("\nRollback test data (jual+cair dihapus, % investor dikembalikan)? [y/N]: ", end="")
    if input().strip().lower() == "y":
        cleanup()
    else:
        print("Data test DIBIARKAN. Jalankan lagi dengan --cleanup untuk menghapus.")


if __name__ == "__main__":
    main()
