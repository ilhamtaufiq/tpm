"""
Script: Koreksi data akibat bug edit muatan (13 Okt 2026).

Defect 1 — kas pembayaran piutang tertimpa:
    Edit muatan LUNAS mencari kas hanya dengan `referensi_id == muatan.id`.
    Kas pembayaran piutang memakai `referensi_id = pembayaran.id`, jadi bila id-nya
    kebetulan sama, nominal kas itu ditimpa laba_tpm muatan dan akunnya dipindah
    ke KAS_UNIT_JASA_ANGKUT. Deteksi: kas MASUK ber-nomor_referensi = nomor
    piutang, referensi_id = id pembayaran piutang itu, tapi nominal/metode beda
    dengan baris pembayaran_piutang (sumber kebenaran).
    Perbaikan: kembalikan nominal + metode dari pembayaran_piutang dan akun yang
    diberikan eksplisit (akun asli tidak tersimpan).

Defect 2 — pemasukan muatan dicatat ganda:
    Muatan yang sudah lunas lewat pembayaran piutang lalu diedit, dibuatkan lagi
    kas "Pemasukan Jasa Angkut" (nomor_referensi = nomor muatan).
    Perbaikan: entri koreksi KELUAR di akun & tanggal yang sama.

Defect 3 — setoran dari saldo semu:
    Setoran unit JA → bank yang isinya saldo semu dari defect 1 & 2. Perbaikan:
    entri koreksi kebalikan kedua kaki transfer (hanya ID yang diminta).

Defect 4 — harga muatan diubah setelah piutang lunas:
    Piutang LUNAS tidak ikut disesuaikan, jadi pembayaran yang tercatat lebih kecil
    dari bagian TPM. Perbaikan (hanya nomor piutang yang diminta): nominal piutang
    = bagian TPM, tambah pembayaran piutang sebesar selisihnya + kas MASUK.

Defect 5 — kas pembayaran piutang ikut terhapus saat void transaksi bengkel:
    Void bengkel menghapus kas `referensi_id == transaksi.id` (sumber BENGKEL),
    termasuk kas pembayaran piutang yang id pembayarannya sama (13 Okt 2026:
    void BGL2610130004 id 31 menghapus kas pembayaran #31 PTG2610050006 350.000).
    Perbaikan: buat ulang kas dari baris pembayaran_piutang (akun eksplisit).

Script TIDAK menebak: tanpa --apply hanya menampilkan kandidat.

Pemakaian (dari folder backend/):
    python scripts/fix_kas_tertimpa_muatan.py
    python scripts/fix_kas_tertimpa_muatan.py --apply \\
        --restore 105:BANK_UTAMA 106:BANK_UTAMA 108:KAS_UTAMA \\
        --balik-ganda 182 --balik-setoran 184 185 \\
        --tambah-bayar AR2610130007 AR2610130014 --tanggal-bayar 2026-10-13 \\
        --pulihkan-bayar 31:KAS_UTAMA
"""
import argparse
import os
import sys
from datetime import date
from decimal import Decimal

from sqlalchemy import func

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.jasa_angkut import MuatanJasaAngkut
from app.models.keuangan import KasBank, PembayaranPiutang, PiutangUsaha
from app.services.kas_bank_integration import create_kas_entry
from app.services.kas_bank_service import KasBankService
from app.models.jasa_angkut import JasaAngkutBiayaLainnya
from app.utils.constants import (
    KasBankJenis,
    KasBankSource,
    KasBankType,
    PaymentMethod,
    PiutangSource,
    PiutangStatus,
)


def kas_tertimpa(db):
    """Kas pembayaran piutang yang nominal/metodenya tidak cocok lagi dengan pembayarannya."""
    rows = (
        db.query(KasBank, PembayaranPiutang)
        .join(PiutangUsaha, PiutangUsaha.nomor_piutang == KasBank.nomor_referensi)
        .join(
            PembayaranPiutang,
            (PembayaranPiutang.id == KasBank.referensi_id) & (PembayaranPiutang.piutang_id == PiutangUsaha.id),
        )
        .filter(KasBank.tipe == KasBankType.MASUK, ~KasBank.keterangan.ilike("[VOID]%"))
        .order_by(KasBank.id)
        .all()
    )
    return [
        (k, p) for k, p in rows
        if Decimal(str(k.nominal)) != Decimal(str(p.nominal)) or k.metode_bayar != p.metode_bayar
    ]


def kas_ganda(db):
    """Kas pemasukan langsung muatan yang piutangnya sudah lunas lewat pembayaran."""
    out = []
    rows = (
        db.query(KasBank, MuatanJasaAngkut, PiutangUsaha)
        .join(MuatanJasaAngkut, MuatanJasaAngkut.nomor_transaksi == KasBank.nomor_referensi)
        .join(
            PiutangUsaha,
            (PiutangUsaha.referensi_id == MuatanJasaAngkut.id) & (PiutangUsaha.sumber == PiutangSource.JASA_ANGKUT),
        )
        .filter(
            KasBank.tipe == KasBankType.MASUK,
            KasBank.sumber == KasBankSource.JASA_ANGKUT,
            PiutangUsaha.status == PiutangStatus.LUNAS,
            ~KasBank.keterangan.ilike("[VOID]%"),
        )
        .order_by(KasBank.id)
        .all()
    )
    for k, m, p in rows:
        dibayar = sum((Decimal(str(x.nominal)) for x in p.pembayaran), Decimal("0"))
        sudah_dikoreksi = db.query(KasBank.id).filter(
            KasBank.nomor_referensi == k.nomor_referensi,
            KasBank.keterangan.ilike(f"[KOREKSI] %{k.nomor_transaksi}%"),
        ).first()
        if dibayar > 0 and not sudah_dikoreksi:
            out.append((k, m, p, dibayar))
    return out


def piutang_kurang_bayar(db):
    """Piutang muatan LUNAS yang pembayarannya < bagian TPM muatan."""
    out = []
    rows = (
        db.query(PiutangUsaha, MuatanJasaAngkut)
        .join(
            MuatanJasaAngkut,
            (MuatanJasaAngkut.id == PiutangUsaha.referensi_id)
            & (MuatanJasaAngkut.nomor_transaksi == PiutangUsaha.nomor_referensi),
        )
        .filter(PiutangUsaha.sumber == PiutangSource.JASA_ANGKUT, PiutangUsaha.status == PiutangStatus.LUNAS)
        .order_by(PiutangUsaha.id)
        .all()
    )
    for p, m in rows:
        biaya = db.query(func.coalesce(func.sum(JasaAngkutBiayaLainnya.jumlah), 0)).filter(
            JasaAngkutBiayaLainnya.muatan_id == m.id
        ).scalar()
        net = max(Decimal("0"), Decimal(str(m.laba_tpm)) - Decimal(str(biaya or 0)))
        dibayar = sum((Decimal(str(x.nominal)) for x in p.pembayaran), Decimal("0"))
        if dibayar > 0 and net != dibayar:
            out.append((p, m, net, dibayar))
    return out


def bayar_tanpa_kas(db):
    """Pembayaran piutang tanpa kas apa pun yang merujuk nomornya dengan nominal sama."""
    from sqlalchemy import or_
    out = []
    rows = (
        db.query(PembayaranPiutang, PiutangUsaha)
        .join(PiutangUsaha, PiutangUsaha.id == PembayaranPiutang.piutang_id)
        .filter(PiutangUsaha.status != PiutangStatus.BATAL)
        .order_by(PembayaranPiutang.id)
        .all()
    )
    for b, p in rows:
        refs = [r for r in (p.nomor_piutang, p.nomor_referensi) if r]
        ada = db.query(KasBank.id).filter(
            KasBank.tipe == KasBankType.MASUK,
            or_(
                (KasBank.referensi_id == b.id) & (KasBank.nomor_referensi == p.nomor_piutang),
                KasBank.nomor_referensi.in_(refs) & (KasBank.nominal == b.nominal),
            ),
        ).first()
        if not ada:
            out.append((b, p))
    return out


def koreksi(db, entry, tipe, alasan):
    return create_kas_entry(
        db=db,
        tanggal=entry.tanggal,
        tipe=tipe,
        nominal=entry.nominal,
        sumber=entry.sumber,
        metode_bayar=entry.metode_bayar,
        referensi_id=entry.referensi_id,
        nomor_referensi=entry.nomor_referensi,
        keterangan=f"[KOREKSI] {alasan} {entry.nomor_transaksi}: {entry.keterangan}"[:500],
        kas_jenis=entry.jenis,
        allow_negative=True,
        commit=False,
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--restore", nargs="*", default=[], help="ID:AKUN, mis. 105:BANK_UTAMA")
    ap.add_argument("--balik-ganda", nargs="*", type=int, default=[])
    ap.add_argument("--balik-setoran", nargs="*", type=int, default=[])
    ap.add_argument("--tambah-bayar", nargs="*", default=[], help="nomor piutang")
    ap.add_argument("--pulihkan-bayar", nargs="*", default=[], help="ID_PEMBAYARAN:AKUN, mis. 31:KAS_UTAMA")
    ap.add_argument("--tanggal-bayar", type=date.fromisoformat, default=None)
    args = ap.parse_args()

    db = SessionLocal()
    try:
        print("== Defect 1: kas pembayaran piutang tertimpa ==")
        tertimpa = {k.id: (k, p) for k, p in kas_tertimpa(db)}
        for k, p in tertimpa.values():
            print(
                f"  id={k.id:4} {k.nomor_transaksi} {k.nomor_referensi:14} sekarang {k.jenis.value}/"
                f"{k.metode_bayar.value} {k.nominal:>14,.2f} | pembayaran #{p.id} {p.metode_bayar.value} {p.nominal:>14,.2f}"
            )
        print("== Defect 2: pemasukan muatan ganda (sudah lunas via piutang) ==")
        ganda = {k.id: (k, m, p, d) for k, m, p, d in kas_ganda(db)}
        for k, m, p, d in ganda.values():
            print(
                f"  id={k.id:4} {k.nomor_transaksi} {m.nomor_transaksi} {k.jenis.value} {k.nominal:>14,.2f}"
                f" | {p.nomor_piutang} dibayar {d:,.2f}"
            )

        print("== Defect 4: piutang lunas, pembayaran != bagian TPM muatan ==")
        kurang = {p.nomor_piutang: (p, m, n, d) for p, m, n, d in piutang_kurang_bayar(db)}
        for p, m, n, d in kurang.values():
            print(f"  {p.nomor_piutang} {m.nomor_transaksi} bagian TPM {n:>12,.2f} dibayar {d:>12,.2f} selisih {n - d:>12,.2f}")

        print("== Defect 5: pembayaran piutang tanpa kas ==")
        tanpa_kas = {b.id: (b, p) for b, p in bayar_tanpa_kas(db)}
        for b, p in tanpa_kas.values():
            print(f"  pembayaran #{b.id} {b.tanggal} {p.nomor_piutang} {p.nama_debitur} {b.metode_bayar.value} {b.nominal:>12,.2f} {b.catatan or ''}")

        if not args.apply:
            print("\nMode kering. Tambahkan --apply dengan ID eksplisit untuk menulis.")
            return 0

        affected = set()
        for spec in args.restore:
            kid, akun = spec.split(":")
            kid = int(kid)
            if kid not in tertimpa:
                print(f"  id={kid} bukan kandidat defect 1, dilewati.")
                continue
            k, p = tertimpa[kid]
            target = KasBankJenis(akun)
            affected.update({k.jenis, target})
            print(f"  restore id={kid}: {k.nominal:,.2f} {k.jenis.value} -> {p.nominal:,.2f} {target.value} ({p.metode_bayar.value})")
            k.nominal = p.nominal
            k.metode_bayar = p.metode_bayar
            k.jenis = target

        for kid in args.balik_ganda:
            if kid not in ganda:
                print(f"  id={kid} bukan kandidat defect 2, dilewati.")
                continue
            k = ganda[kid][0]
            koreksi(db, k, KasBankType.KELUAR, "Pemasukan ganda (sudah lunas via piutang)")
            affected.add(k.jenis)
            print(f"  koreksi ganda id={kid}: KELUAR {k.nominal:,.2f} {k.jenis.value}")

        for kid in args.balik_setoran:
            k = db.get(KasBank, kid)
            if k is None or not k.keterangan.startswith(("Transfer ke ", "Transfer dari ")):
                print(f"  id={kid} bukan baris transfer, dilewati.")
                continue
            sudah = db.query(KasBank.id).filter(
                KasBank.keterangan.like(f"[KOREKSI] Setoran dari saldo semu {k.nomor_transaksi}:%")
            ).first()
            if sudah:
                print(f"  id={kid} sudah dikoreksi (kas id={sudah.id}), dilewati.")
                continue
            balik = KasBankType.KELUAR if k.tipe == KasBankType.MASUK else KasBankType.MASUK
            koreksi(db, k, balik, "Setoran dari saldo semu")
            affected.add(k.jenis)
            print(f"  koreksi setoran id={kid}: {balik.value} {k.nominal:,.2f} {k.jenis.value}")

        for nomor in args.tambah_bayar:
            if nomor not in kurang:
                print(f"  {nomor} bukan kandidat defect 4, dilewati.")
                continue
            p, m, net, dibayar = kurang[nomor]
            selisih = net - dibayar
            if selisih <= 0:
                print(f"  {nomor}: bayar lebih ({selisih:,.2f}), perlu ditangani manual, dilewati.")
                continue
            tanggal = args.tanggal_bayar or date.today()
            bayar = PembayaranPiutang(
                piutang_id=p.id,
                tanggal=tanggal,
                nominal=selisih,
                metode_bayar=PaymentMethod.TRANSFER,
                catatan=f"[KOREKSI] Selisih harga {m.nomor_transaksi} setelah lunas",
            )
            db.add(bayar)
            db.flush()
            p.nominal_piutang = net
            p.total_dibayar = net
            p.sisa_piutang = Decimal("0")
            create_kas_entry(
                db=db,
                tanggal=tanggal,
                tipe=KasBankType.MASUK,
                nominal=selisih,
                sumber=KasBankSource.JASA_ANGKUT,
                metode_bayar=PaymentMethod.TRANSFER,
                referensi_id=bayar.id,
                nomor_referensi=p.nomor_piutang,
                keterangan=f"[KOREKSI] Selisih pelunasan piutang {p.nomor_piutang} ({m.nomor_transaksi}) (TRANSFER)",
                kas_jenis=KasBankJenis.BANK_UTAMA,
                allow_negative=True,
                commit=False,
            )
            affected.add(KasBankJenis.BANK_UTAMA)
            print(f"  {nomor}: tambah bayar {selisih:,.2f} TRANSFER BANK_UTAMA {tanggal}")

        for spec in args.pulihkan_bayar:
            bid, akun = spec.split(":")
            bid = int(bid)
            if bid not in tanpa_kas:
                print(f"  pembayaran #{bid} bukan kandidat defect 5, dilewati.")
                continue
            b, p = tanpa_kas[bid]
            target = KasBankJenis(akun)
            unit = p.unit or KasBankSource.PIUTANG
            label = str(getattr(unit, "value", unit)).replace("_", " ").title()
            create_kas_entry(
                db=db,
                tanggal=b.tanggal,
                tipe=KasBankType.MASUK,
                nominal=b.nominal,
                sumber=unit,
                metode_bayar=b.metode_bayar,
                referensi_id=b.id,
                nomor_referensi=p.nomor_piutang,
                keterangan=f"[KOREKSI] [{label}] Pembayaran piutang {p.nomor_piutang} - {p.nama_debitur} ({b.metode_bayar.value}) dipulihkan",
                kas_jenis=target,
                allow_negative=True,
                commit=False,
            )
            affected.add(target)
            print(f"  pulihkan kas pembayaran #{bid}: MASUK {b.nominal:,.2f} {target.value} {b.tanggal}")

        if not affected:
            db.rollback()
            print("\nTidak ada yang berubah.")
            return 0

        db.flush()
        service = KasBankService(db)
        for jenis in sorted(affected, key=lambda j: j.value):
            result = service.rebuild_balances(jenis)
            print(f"  saldo {jenis.value} dihitung ulang: {result['updated']} baris")
        db.commit()
        print("\nSelesai.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
