"""Fix DP awal SOPIAN (piutang PTG2609170002) yang tak punya baris PembayaranPiutang.

Bug: `penjualan_mobil_service.create` lama menulis `nominal_piutang = sisa_bayar`
(harga jual − DP) dan DP awal hanya masuk kas, tanpa baris PembayaranPiutang.
Laporan (`base.py get_piutang_balance`) = Σ nominal − Σ PembayaranPiutang, jadi
selisih 2jt tak tampil di riwayat pembayaran meski uang sudah masuk kas.

Perbaikan data (transaksi lama saja; kode untuk transaksi baru sudah diperbaiki):
- nominal_piutang  → harga jual penuh (naikkan sebesar gap)
- total_dibayar    → naikkan sebesar gap
- sisa_piutang     → TIDAK diubah
- insert 1 baris PembayaranPiutang = gap (kas 2jt sudah ada; JANGAN tulis kas baru)

Dry-run default; pakai `--apply` utk menulis. Idempoten: baris yang sudah cocok
tidak menghasilkan apa pun, dan `NOT EXISTS` mencegah dobel.

Usage: python fix_sopian_dp_2jt.py [--apply]
"""
import sys
from decimal import Decimal

from app.database.connection import SessionLocal
from app.models.keuangan import PiutangUsaha, PembayaranPiutang
from app.models.mobil import TransaksiPenjualanMobil
from app.utils.constants import PiutangSource, PaymentStatus

apply = "--apply" in sys.argv
db = SessionLocal()
try:
    # Temukan piutang jual-beli mobil yang nominal < harga jual (gap = DP awal tanpa baris).
    rows = (
        db.query(PiutangUsaha, TransaksiPenjualanMobil)
        .join(TransaksiPenjualanMobil, TransaksiPenjualanMobil.nomor_transaksi == PiutangUsaha.nomor_referensi)
        .filter(
            PiutangUsaha.sumber == PiutangSource.JUAL_BELI_MOBIL,
            PiutangUsaha.status != "BATAL",
            TransaksiPenjualanMobil.status_bayar != PaymentStatus.BATAL,
            TransaksiPenjualanMobil.harga_jual > PiutangUsaha.nominal_piutang,
        )
        .all()
    )

    print(f"GAP jual-beli mobil: {len(rows)}  (apply={apply})")
    for pu, t in rows:
        gap = Decimal(str(t.harga_jual)) - Decimal(str(pu.nominal_piutang))
        tercatat = Decimal(str(sum(p.nominal for p in pu.pembayaran)))
        print(
            f"  piutang #{pu.id} {pu.nomor_piutang} (sale {t.nomor_transaksi}) "
            f"harga={t.harga_jual} nominal={pu.nominal_piutang} gap={gap} "
            f"total_dibayar={pu.total_dibayar} sisa={pu.sisa_piutang} Σpay={tercatat}"
        )
        if gap <= 0:
            continue

        # Gap harus persis DP awal yang sudah masuk kas tapi belum ada baris piutang.
        # total_dibayar naik sebesar gap → Σpay == total_dibayar setelah insert.
        if apply:
            sudah = db.query(PembayaranPiutang).filter(
                PembayaranPiutang.piutang_id == pu.id,
                PembayaranPiutang.nominal == gap,
                PembayaranPiutang.catatan.like("DP TAHAP 1%"),
            ).first()
            if sudah:
                print(f"    SKIP #{pu.id}: baris DP TAHAP 1 sudah ada")
                continue

            pu.nominal_piutang += gap
            pu.total_dibayar += gap
            # sisa_piutang tidak diubah (gap = DP yang sudah dibayar, bukan sisa baru)
            db.add(PembayaranPiutang(
                piutang_id=pu.id,
                tanggal=t.tanggal,
                nominal=gap,
                metode_bayar=t.metode_bayar or "TRANSFER",
                catatan=f"DP TAHAP 1 {t.nomor_transaksi}",
                created_by=t.created_by,
            ))
            print(f"    FIX #{pu.id}: nominal={pu.nominal_piutang} total_dibayar={pu.total_dibayar} +pay {gap}")

    if apply:
        db.commit()
        print("committed.")
finally:
    db.close()