"""Pindahkan baris part dari nota lama ke NOTA TAMBAHAN di bulan lain (selaras Excel).

Dipakai sekali untuk menyelaraskan data yang di Excel diposting di bulan N tetapi di
aplikasi masih menempel di nota bulan N-1 (contoh: 114 baris nota Oktober yang di Excel
masuk November). Baris dipindah, BUKAN dijual ulang: stok tidak berubah, HPP historis
tiap baris dipertahankan, hutang/piutang internal dan stok mobil mengikuti nota baru.

CSV (UTF-8, header wajib): nota, item_dump, qty, penjualan, hpp, tgl_excel, status
  - nota        : nomor nota asal (mis. BGL2610060004)
  - item_dump   : nama part di aplikasi
  - qty         : jumlah
  - penjualan   : TOTAL baris (qty x harga jual)
  - hpp         : TOTAL HPP baris (hanya untuk laporan, HPP asli diambil dari baris nota)
  - tgl_excel   : hari (1-31) pada bulan tujuan (--bulan)
  - status      : hanya baris berstatus COCOK yang dipindah

Aturan:
  - Baris yang tidak ditemukan di nota asal dilewati dan dilaporkan.
  - Periode nota asal dan periode tujuan harus TERBUKA (posting Oktober dilakukan SETELAH skrip ini).
  - Nota tambahan dikelompokkan per nota asal dan per --kelompok (hari | minggu | bulan);
    tanggalnya = tanggal terakhir dalam kelompok.

Pemakaian:
    python scripts/pindah_baris_ke_nota_tambahan.py --csv data.csv --bulan 2026-11            # dry-run
    python scripts/pindah_baris_ke_nota_tambahan.py --csv data.csv --bulan 2026-11 --apply    # simpan
"""
import argparse
import csv
import os
import sys
from collections import defaultdict
from datetime import date
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal  # noqa: E402
from app.models.bengkel import SparePart, TransaksiPenjualanBengkel  # noqa: E402
from app.schemas.bengkel import (  # noqa: E402
    DetailPartCreate,
    DetailServiceCreate,
    TransaksiBengkelCreate,
)
from app.services.periode_posting_service import PeriodePostingService  # noqa: E402
from app.services.transaksi_bengkel_service import TransaksiBengkelService  # noqa: E402

# Batas minggu mengikuti blok Excel: 1-8, 9-15, 16-22, 23-29, 30-31
BATAS_MINGGU = [8, 15, 22, 29, 31]


def kunci_kelompok(hari: int, kelompok: str) -> int:
    if kelompok == "hari":
        return hari
    if kelompok == "bulan":
        return 0
    for i, batas in enumerate(BATAS_MINGGU):
        if hari <= batas:
            return i
    return len(BATAS_MINGGU)


def baca_csv(path: str):
    with open(path, newline="", encoding="utf-8") as fh:
        return [r for r in csv.DictReader(fh) if (r.get("status") or "").strip().upper() == "COCOK"]


def cocokkan(db, baris_csv):
    """Kembalikan {nota: [(detail, hari), ...]} serta daftar baris yang tidak ketemu."""
    per_nota = defaultdict(list)
    for r in baris_csv:
        per_nota[r["nota"].strip()].append(r)
    hasil, tidak_ketemu = {}, []
    for nomor, baris in per_nota.items():
        t = (
            db.query(TransaksiPenjualanBengkel)
            .filter(TransaksiPenjualanBengkel.nomor_transaksi == nomor)
            .first()
        )
        if t is None:
            tidak_ketemu += [(nomor, r["item_dump"], "nota tidak ada") for r in baris]
            continue
        terpakai, dipilih = set(), []
        for r in baris:
            nama = (r["item_dump"] or "").strip().upper()
            qty, total = Decimal(r["qty"]), Decimal(r["penjualan"])
            ketemu = None
            for d in t.detail_parts:
                if d.id in terpakai:
                    continue
                sp = db.get(SparePart, d.spare_part_id)
                if (sp.nama or "").strip().upper() == nama and abs(Decimal(d.qty) - qty) < Decimal("0.01") \
                        and abs(Decimal(d.qty) * Decimal(d.harga_jual) - total) < 1:
                    ketemu = d
                    break
            if ketemu is None:
                tidak_ketemu.append((nomor, r["item_dump"], "baris tidak cocok di nota"))
                continue
            terpakai.add(ketemu.id)
            dipilih.append((ketemu, int(float(r["tgl_excel"]))))
        hasil[nomor] = (t, dipilih)
    return hasil, tidak_ketemu


def payload_dari_nota(t, detail_parts, detail_services):
    return TransaksiBengkelCreate(
        tanggal=t.tanggal,
        customer_id=t.customer_id,
        nama_customer=t.nama_customer,
        nomor_plat=t.nomor_plat,
        jenis_kendaraan=t.jenis_kendaraan,
        kategori=t.kategori or "umum",
        muatan_id=t.muatan_id,
        armada_id=t.armada_id,
        mobil_id=t.mobil_id,
        detail_parts=detail_parts,
        detail_services=detail_services,
        diskon=t.diskon,
        tampilkan_diskon_struk=bool(getattr(t, "tampilkan_diskon_struk", True)),
        metode_bayar=t.metode_bayar,
        jumlah_bayar=t.jumlah_bayar,
        payments=[],
        status_pengerjaan=t.status_pengerjaan,
        catatan=t.catatan,
    )


def jalankan(db, csv_path: str, bulan: str, kelompok: str = "minggu", apply: bool = False):
    tahun, bln = (int(x) for x in bulan.split("-"))
    hasil, tidak_ketemu = cocokkan(db, baca_csv(csv_path))
    periode = PeriodePostingService(db)
    total_jual = total_hpp = Decimal("0")
    for nomor, (t, dipilih) in hasil.items():
        jual = sum(Decimal(d.qty) * Decimal(d.harga_jual) for d, _ in dipilih)
        hpp = sum(Decimal(d.qty) * Decimal(d.harga_beli) for d, _ in dipilih)
        total_jual += jual
        total_hpp += hpp
        print(f"{nomor} ({t.tanggal}, {t.kategori}, {t.status_bayar.value}): pindah {len(dipilih)} baris, "
              f"penjualan {jual:,.0f}, HPP {hpp:,.0f}; grand_total {t.grand_total:,.0f} -> {t.grand_total - jual:,.0f}")
        periode.pastikan_terbuka(t.tanggal, f"Nota asal {nomor} terkunci")
    print(f"TOTAL dipindah: penjualan {total_jual:,.0f}, HPP {total_hpp:,.0f}, laba kotor {total_jual - total_hpp:,.0f}")
    print(f"Baris dilewati: {len(tidak_ketemu)}")
    for n, item, alasan in tidak_ketemu:
        print(f"  - {n} {item}: {alasan}")
    if not apply:
        print("Dry-run: tidak ada yang disimpan. Jalankan dengan --apply untuk menyimpan.")
        return hasil, tidak_ketemu

    svc = TransaksiBengkelService(db)
    for nomor, (t, dipilih) in hasil.items():
        pindah_ids = {d.id for d, _ in dipilih}
        # 1. Nota asal: buang baris yang dipindah (stok dikembalikan lalu dipotong ulang oleh update()).
        sisa_parts = [
            DetailPartCreate(spare_part_id=d.spare_part_id, qty=d.qty, harga_jual=d.harga_jual)
            for d in t.detail_parts if d.id not in pindah_ids
        ]
        jasa = [
            DetailServiceCreate(nama_jasa=s.nama_jasa, deskripsi=s.deskripsi, harga=s.harga, qty=s.qty)
            for s in t.detail_services
        ]
        kelompok_baris = defaultdict(list)
        for d, hari in dipilih:
            kelompok_baris[kunci_kelompok(hari, kelompok)].append((d, hari))
        # Simpan data baris sebelum nota asal ditulis ulang
        catatan_baris = {
            k: [(d.spare_part_id, Decimal(d.qty), Decimal(d.harga_jual), Decimal(d.harga_beli), hari) for d, hari in v]
            for k, v in kelompok_baris.items()
        }
        svc.update(t.id, payload_dari_nota(t, sisa_parts, jasa), user_id=None)

        # 2. Nota tambahan per kelompok
        for k, baris in sorted(catatan_baris.items()):
            tanggal_tambahan = date(tahun, bln, max(h for *_, h in baris))
            periode.pastikan_terbuka(tanggal_tambahan, "Nota tambahan terkunci")
            tambah_parts = [DetailPartCreate(spare_part_id=sp, qty=q, harga_jual=hj) for sp, q, hj, _hb, _h in baris]
            t_asal = svc.get_by_nomor(nomor)
            baru = svc.create(payload_dari_nota(t_asal, tambah_parts, []), user_id=None)
            baru = svc.get_by_id(baru.id)
            # HPP historis baris asal dipertahankan (create() memakai harga master saat ini)
            sisa_hb = list(baris)
            hpp_total = Decimal("0")
            for det in baru.detail_parts:
                cocok = next((b for b in sisa_hb if b[0] == det.spare_part_id and b[1] == Decimal(det.qty)), None)
                if cocok:
                    sisa_hb.remove(cocok)
                    det.harga_beli = cocok[3]
                hpp_total += Decimal(det.harga_beli) * Decimal(det.qty)
            baru.hpp_parts = hpp_total
            baru.laba_kotor = Decimal(baru.grand_total) - hpp_total
            baru.induk_nomor = nomor
            baru.catatan = f"Tambahan dari nota {nomor} (penyelarasan posting)"
            tanggal_lama = baru.tanggal
            baru.tanggal = tanggal_tambahan
            svc._sync_tanggal_terkait(baru.nomor_transaksi, tanggal_lama, tanggal_tambahan)
            db.commit()
            print(f"  -> {baru.nomor_transaksi} ({tanggal_tambahan}): {len(baris)} baris, grand_total {baru.grand_total:,.0f}")
    print("Selesai. Periksa laporan, lalu posting periode asal.")
    return hasil, tidak_ketemu


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--csv", required=True, help="CSV baris yang dipindah")
    ap.add_argument("--bulan", required=True, help="Bulan tujuan, format YYYY-MM (mis. 2026-11)")
    ap.add_argument("--kelompok", choices=["hari", "minggu", "bulan"], default="minggu")
    ap.add_argument("--apply", action="store_true", help="simpan perubahan (default: dry-run)")
    args = ap.parse_args()
    db = SessionLocal()
    try:
        jalankan(db, args.csv, args.bulan, args.kelompok, args.apply)
    finally:
        db.close()


if __name__ == "__main__":
    main()
