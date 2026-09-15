"""Cek keberadaan PembayaranPiutang utk piutang yg LUNAS tanpa record.

Usage: python diag_piutang_209_210.py 209 210
"""
import sys
from app.database.connection import SessionLocal
from app.models.keuangan import PiutangUsaha, PembayaranPiutang, KasBank

db = SessionLocal()
try:
    for pid in [int(x) for x in sys.argv[1:]]:
        pu = db.query(PiutangUsaha).get(pid)
        if not pu:
            print(f"piutang {pid}: NOT FOUND")
            continue
        print(f"#{pu.id} {pu.nomor_piutang} tgl={pu.tanggal} nominal={float(pu.nominal_piutang):,.0f} "
              f"dibayar={float(pu.total_dibayar):,.0f} sisa={float(pu.sisa_piutang):,.0f} "
              f"status={pu.status.value} tgl_lunas={pu.tanggal_lunas} ref_id={pu.referensi_id}")
        pays = db.query(PembayaranPiutang).filter(PembayaranPiutang.piutang_id == pid).all()
        print(f"   PembayaranPiutang rows: {len(pays)}")
        for p in pays:
            print(f"     #{p.id} tgl={p.tanggal} nominal={float(p.nominal):,.0f} metode={p.metode_bayar.value}")
        kas = db.query(KasBank).filter(KasBank.nomor_referensi == pu.nomor_piutang).all()
        print(f"   KasBank rows matching nomor_piutang: {len(kas)}")
        for k in kas:
            print(f"     #{k.id} tgl={k.tanggal} {k.jenis.value} {k.tipe.value} "
                  f"{float(k.nominal):,.0f} metode={k.metode_bayar.value} ref_id={k.referensi_id} "
                  f"| {k.keterangan}")
finally:
    db.close()
