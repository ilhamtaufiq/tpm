"""Script: Perbaiki data agar Laporan Perubahan Modal & Neraca balance.

Tiga defect class yang diperbaiki (semuanya sudah ditutup di kode; script ini
memulihkan DATA yang terlanjur rusak sebelum fix kode terpasang):

1. HPP HISTORIS HILANG
   `transaksi_bengkel_service.update()` dulu menghitung ulang hpp_parts dari
   `sp.harga_beli` (harga master SAAT ITU), bukan biaya beli historis. Nota lama
   yang di-save ulang setelah harga master berubah jadi memakai harga baru.
   Rekonstruksi: harga beli = pembelian terakhir dengan tanggal <= tanggal nota
   (itulah yang dipakai `create()` saat nota dibuat). Fallback ke master bila
   part belum pernah dibeli sebelum nota (mis. stok bawaan impor).

2. SALDO KAS TIDAK SINKRON
   `saldo_sebelum`/`saldo_sesudah` dirantai menurut urutan ID (urutan input),
   bukan tanggal - transaksi backdate menyandera rantai. Diperbaiki dengan
   `KasBankService.rebuild_balances()` yang kini mengurut (tanggal, id).

3. MODAL AWAL TERKUNCI DI NILAI SALAH
   Baris `modal_awal_frozen` sempat ditimpa otomatis oleh rumus lama. Setelah
   HPP benar, nilainya dihitung ulang dari posisi pembuka. Baris beku dihapus
   agar report berikutnya membekukan ulang dari data yang sudah bersih.

Pemakaian (dari folder backend/):
    python scripts/fix_laporan_balance.py                 # deteksi saja (dry-run)
    python scripts/fix_laporan_balance.py --apply         # terapkan semua
    python scripts/fix_laporan_balance.py --apply --only hpp

Urutan penting: hpp -> kas -> modal. Modal dihitung dari posisi pembuka, jadi
harus dijalankan setelah HPP benar.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DATABASE_URL', 'mysql+pymysql://root:@localhost/tpm')

from datetime import date
from decimal import Decimal

from app.database import SessionLocal
from app.models.bengkel import (
    DetailPembelianSparePart,
    DetailTransaksiSpareParts,
    PembelianSparePart,
    SparePart,
    TransaksiPenjualanBengkel,
)
from app.models.system_setting import SystemSetting
from app.services.kas_bank_service import KasBankService

STEPS = ("hpp", "kas", "modal")


def _dec(v) -> Decimal:
    return Decimal(str(v or 0))


# ---------------------------------------------------------------------
# 1. HPP historis
# ---------------------------------------------------------------------

def _harga_beli_historis(db, sp: SparePart, tanggal: date):
    """Harga beli yang seharusnya dipakai nota bertanggal `tanggal`.

    Pembelian terakhir dengan tanggal <= tanggal nota - persis yang dilihat
    `create()` saat nota dibuat.

    None bila TIDAK ADA pembelian sebelum nota. Itu bukan berarti harganya
    salah: part bisa berasal dari stok bawaan impor, dan harga yang tercatat di
    nota (harga master saat itu) justru satu-satunya bukti yang tersisa. Karena
    itu pemanggil WAJIB melewatinya, bukan menimpanya dengan harga master kini -
    menimpa akan merusak data yang benar (mis. part yang baru pertama dibeli
    setelah nota, seperti SPR-140 di BGL2609140005).
    """
    row = (
        db.query(DetailPembelianSparePart.harga_satuan)
        .join(PembelianSparePart, DetailPembelianSparePart.pembelian_id == PembelianSparePart.id)
        .filter(
            DetailPembelianSparePart.spare_part_id == sp.id,
            PembelianSparePart.tanggal <= tanggal,
        )
        .order_by(PembelianSparePart.tanggal.desc(), DetailPembelianSparePart.id.desc())
        .first()
    )
    return _dec(row[0]) if row else None


def fix_hpp(db, apply: bool) -> dict:
    """Kembalikan harga beli historis pada detail nota + hitung ulang header."""
    nota_rows = []
    skip_rows = []
    for trx in db.query(TransaksiPenjualanBengkel).order_by(TransaksiPenjualanBengkel.id).all():
        details = (
            db.query(DetailTransaksiSpareParts)
            .filter(DetailTransaksiSpareParts.transaksi_id == trx.id)
            .order_by(DetailTransaksiSpareParts.id)
            .all()
        )
        if not details:
            continue

        changed_details = []
        dilewati = []
        # (detail, harga efektif) -> harga efektif = target bila akan diubah,
        # nilai lama bila tidak. Dipakai memproyeksikan header dengan benar di
        # mode dry-run juga, di mana detail belum benar-benar ditulis.
        efektif = []

        for d in details:
            sp = db.query(SparePart).filter(SparePart.id == d.spare_part_id).first()
            if sp is None:
                efektif.append((d, _dec(d.harga_beli)))
                continue
            target = _harga_beli_historis(db, sp, trx.tanggal)
            if target is None:
                # Tak ada pembelian sebelum nota -> harga di nota adalah satu-satunya
                # bukti. Jangan tebak; lewati dan laporkan.
                if abs(_dec(d.harga_beli) - _dec(sp.harga_beli)) > Decimal("0.01"):
                    dilewati.append({
                        "part": d.spare_part_id,
                        "nota": _dec(d.harga_beli),
                        "master": _dec(sp.harga_beli),
                    })
                efektif.append((d, _dec(d.harga_beli)))
                continue
            if abs(_dec(d.harga_beli) - target) > Decimal("0.01"):
                changed_details.append((d, _dec(d.harga_beli), target))
            efektif.append((d, target))
            if apply:
                d.harga_beli = target

        if dilewati and not changed_details:
            skip_rows.append({
                "trx_id": trx.id,
                "nomor": trx.nomor_transaksi,
                "tanggal": trx.tanggal,
                "dilewati": dilewati,
            })
            continue

        if not changed_details:
            continue

        # Header diturunkan dari detail (harga efektif), bukan dari nilai lama.
        new_hpp = sum((harga * _dec(d.qty) for d, harga in efektif), Decimal("0"))
        new_parts = sum((_dec(d.subtotal) for d in details), Decimal("0"))
        new_laba = _dec(trx.grand_total) - new_hpp

        nota_rows.append({
            "trx_id": trx.id,
            "nomor": trx.nomor_transaksi,
            "tanggal": trx.tanggal,
            "details": [
                {"part": d.spare_part_id, "dari": old, "ke": new}
                for d, old, new in changed_details
            ],
            "hpp": (f"{_dec(trx.hpp_parts):,.2f}", f"{new_hpp:,.2f}"),
            "laba": (f"{_dec(trx.laba_kotor):,.2f}", f"{new_laba:,.2f}"),
        })

        if apply:
            trx.hpp_parts = new_hpp
            trx.laba_kotor = new_laba
            trx.total_parts = new_parts

    if apply and nota_rows:
        db.commit()
    return {"nota": nota_rows, "dilewati": skip_rows}


# ---------------------------------------------------------------------
# 2. Saldo kas
# ---------------------------------------------------------------------

def _saldo_tidak_sinkron(db) -> int:
    """Baris yang saldo_sesudah-nya tidak sama dengan rantai kronologis."""
    from collections import defaultdict

    from app.models.keuangan import KasBank

    by_jenis = defaultdict(list)
    for r in db.query(KasBank).order_by(KasBank.jenis, KasBank.tanggal, KasBank.id).all():
        by_jenis[r.jenis].append(r)

    bad = 0
    for rows in by_jenis.values():
        chain = Decimal("0")
        for r in rows:
            chain += _dec(r.nominal) if r.tipe.value == "MASUK" else -_dec(r.nominal)
            if abs(_dec(r.saldo_sesudah) - chain) > Decimal("0.01"):
                bad += 1
    return bad


def fix_kas(db, apply: bool) -> dict:
    before = _saldo_tidak_sinkron(db)
    result = {"rusak_sebelum": before, "rusak_sesudah": before}
    if apply and before:
        result["rebuild"] = KasBankService(db).rebuild_balances()
        db.expire_all()
        result["rusak_sesudah"] = _saldo_tidak_sinkron(db)
    return result


# ---------------------------------------------------------------------
# 3. Modal awal beku
# ---------------------------------------------------------------------

def fix_modal(db, apply: bool) -> dict:
    """Hapus baris beku agar dibekukan ulang dari posisi pembuka yang bersih.

    `ModalService._frozen_modal_awal` menulis ulang baris ini saat tidak ada,
    jadi menghapusnya adalah jalur beku-ulang yang memang disediakan kode.
    """
    from app.services.reports.modal_service import ModalService

    svc = ModalService(db)
    row = db.query(SystemSetting).filter(
        SystemSetting.key == svc.FROZEN_MODAL_AWAL_KEY
    ).first()
    lama = row.value if row else None

    anchor = svc._saldo_awal_date()
    teoretis = None
    if anchor:
        # Nilai yang AKAN ditulis saat beku ulang: neraca(anchor) - arus hari anchor.
        from app.services.reports.neraca_service import NeracaService
        neraca = NeracaService(db).get_report(anchor)
        teoretis = float(neraca["modal"]["total_modal"]) - svc._equity_flow_on(anchor)

    if apply and row is not None:
        db.delete(row)
        db.commit()

    return {"lama": lama, "teoretis": teoretis, "dihapus": bool(apply and row is not None)}


# ---------------------------------------------------------------------
# Verifikasi
# ---------------------------------------------------------------------

def cek_balance(db):
    from app.services.reports.modal_service import ModalService
    from app.services.reports.neraca_service import NeracaService

    ms, ns = ModalService(db), NeracaService(db)
    keluar = []
    for d in range(12, 18):
        tgl = date(2026, 9, d)
        m = ms.get_report(tgl, tgl)
        n = ns.get_report(tgl)
        keluar.append({
            "tanggal": tgl.isoformat(),
            "modal_selisih": float(m["selisih"]),
            "modal_ok": bool(m.get("is_balanced")),
            "neraca_selisih": float(n["selisih"]),
            "neraca_ok": bool(n["is_balanced"]),
        })
    tahunan = ms.get_report(date(2026, 1, 1), date(2026, 12, 31))
    return keluar, {
        "modal_awal": float(tahunan["modal_awal"]),
        "selisih": float(tahunan["selisih"]),
        "ok": bool(tahunan.get("is_balanced")),
    }


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--apply", action="store_true", help="terapkan perubahan (default: hanya deteksi)")
    ap.add_argument("--only", choices=STEPS, help="jalankan satu langkah saja")
    args = ap.parse_args()

    steps = (args.only,) if args.only else STEPS
    db = SessionLocal()
    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"=== fix_laporan_balance [{mode}] langkah: {', '.join(steps)} ===\n")

    try:
        if "hpp" in steps:
            print("-- 1. HPP historis --")
            res = fix_hpp(db, args.apply)
            if not res["nota"] and not res["dilewati"]:
                print("   tidak ada nota yang perlu diperbaiki")
            for r in res["dilewati"]:
                print(f"   LEWAT {r['nomor']} (id {r['trx_id']}, {r['tanggal']}) - "
                      f"tak ada pembelian sebelum tanggal nota, harga di nota dipertahankan:")
                for d in r["dilewati"]:
                    print(f"      part {d['part']}: nota {d['nota']:,.2f} vs master kini {d['master']:,.2f}")
            for r in res["nota"]:
                print(f"   nota {r['nomor']} (id {r['trx_id']}, {r['tanggal']})")
                for d in r["details"]:
                    print(f"      part {d['part']}: {d['dari']:,.2f} -> {d['ke']:,.2f}")
                print(f"      hpp_parts  {r['hpp'][0]} -> {r['hpp'][1]}")
                print(f"      laba_kotor {r['laba'][0]} -> {r['laba'][1]}")
            print()

        if "kas" in steps:
            print("-- 2. Saldo kas --")
            res = fix_kas(db, args.apply)
            print(f"   baris tidak sinkron: {res['rusak_sebelum']} -> {res['rusak_sesudah']}")
            if "rebuild" in res:
                print(f"   rebuild: {res['rebuild']}")
            print()

        if "modal" in steps:
            print("-- 3. Modal awal beku --")
            res = fix_modal(db, args.apply)
            print(f"   nilai lama  : {res['lama']}")
            if res["teoretis"] is not None:
                print(f"   nilai benar : amount = {res['teoretis']:.2f}")
            hapus = "DIHAPUS (beku ulang saat report berikutnya)" if res["dihapus"] else "dibiarkan (dry-run)"
            print(f"   baris beku  : {hapus}")
            print()

        print("-- Verifikasi --")
        rows, ringkas = cek_balance(db)
        for r in rows:
            tanda = "OK  " if (r["modal_ok"] and r["neraca_ok"]) else "BEDA"
            print(
                f"   {r['tanggal']} [{tanda}] modal_selisih={r['modal_selisih']:>16,.2f}"
                f"  neraca_selisih={r['neraca_selisih']:>16,.2f}"
            )
        print()
        print(f"   modal_awal tahunan : {ringkas['modal_awal']:,.2f}")
        print(f"   selisih tahunan    : {ringkas['selisih']:,.2f}")
        print(f"   seimbang           : {ringkas['ok']}")

        if not args.apply:
            print("\n(dry-run - jalankan dengan --apply untuk menerapkan)")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
