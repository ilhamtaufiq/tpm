"""Posting bulanan: periode terkunci, nota tambahan, buka kembali (admin)."""
from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.database import SessionLocal
from app.models.bengkel import SparePart, TransaksiPenjualanBengkel
from app.models.perbaikan_data_log import PerbaikanDataLog
from app.models.periode_posting import PeriodePosting
from app.schemas.bengkel import DetailPartCreate, DetailServiceCreate, TransaksiBengkelCreate
from app.services.periode_posting_service import PeriodePostingService
from app.services.transaksi_bengkel_service import TransaksiBengkelService
from app.utils.constants import PaymentMethod, WorkshopStatus

TAHUN_UJI, BULAN_UJI = 2001, 3  # bulan lampau yang tidak dipakai data nyata


def _sp(db):
    sp = db.query(SparePart).filter(SparePart.deleted_at.is_(None), SparePart.stok > 10).first()
    if sp is None:
        pytest.skip("tidak ada sparepart stok cukup")
    return sp


def _payload(sp, qty=1, jasa=None, **extra):
    base = dict(
        kategori="umum",
        jenis_kendaraan="UJI POSTING",
        nomor_plat="UJI-POSTING",
        detail_parts=[DetailPartCreate(spare_part_id=sp.id, qty=qty, harga_jual=Decimal("10000"))] if qty else [],
        detail_services=[DetailServiceCreate(nama_jasa=n, harga=Decimal(h), qty=1) for n, h in (jasa or [])],
        status_pengerjaan=WorkshopStatus.PROSES,
        metode_bayar=PaymentMethod.TUNAI,
        jumlah_bayar=Decimal("0"),
    )
    base.update(extra)
    return TransaksiBengkelCreate(**base)


def _bersihkan(db, nomor_list):
    # buka kunci uji lalu batalkan nota uji agar stok kembali
    db.query(PeriodePosting).filter(
        PeriodePosting.tahun == TAHUN_UJI, PeriodePosting.bulan == BULAN_UJI
    ).delete(synchronize_session=False)
    db.query(PerbaikanDataLog).filter(
        PerbaikanDataLog.nomor_referensi == f"{TAHUN_UJI}-{BULAN_UJI:02d}"
    ).delete(synchronize_session=False)
    db.commit()
    service = TransaksiBengkelService(db)
    for nomor in nomor_list:
        t = service.get_by_nomor(nomor)
        if t is not None:
            db.query(PeriodePosting).filter(PeriodePosting.tahun == t.tanggal.year, PeriodePosting.bulan == t.tanggal.month,
                                            PeriodePosting.status == "DIPOSTING",
                                            PeriodePosting.alasan_buka.is_(None)).delete(synchronize_session=False)
            db.commit()
            try:
                service.void_transaction(t.id, "bersihkan data uji")
            except HTTPException:
                pass


def test_posting_bulan_berjalan_ditolak():
    db = SessionLocal()
    try:
        hari_ini = date.today()
        with pytest.raises(HTTPException) as exc:
            PeriodePostingService(db).posting(hari_ini.year, hari_ini.month, None)
        assert exc.value.status_code == 409
    finally:
        db.close()


def test_posting_dan_buka_kembali_tercatat():
    db = SessionLocal()
    try:
        svc = PeriodePostingService(db)
        r = svc.posting(TAHUN_UJI, BULAN_UJI, None, "uji")
        assert r["status"] == "DIPOSTING"
        with pytest.raises(HTTPException) as exc:
            svc.posting(TAHUN_UJI, BULAN_UJI, None)
        assert exc.value.status_code == 409
        with pytest.raises(HTTPException) as exc:
            svc.buka_kembali(TAHUN_UJI, BULAN_UJI, None, "x")
        assert exc.value.status_code == 422
        r = svc.buka_kembali(TAHUN_UJI, BULAN_UJI, None, "koreksi data uji")
        assert r["status"] == "TERBUKA" and r["alasan_buka"] == "koreksi data uji"
        jenis = {
            l.jenis for l in db.query(PerbaikanDataLog).filter(
                PerbaikanDataLog.nomor_referensi == f"{TAHUN_UJI}-{BULAN_UJI:02d}"
            ).all()
        }
        assert {"POSTING_PERIODE", "BUKA_PERIODE"} <= jenis
    finally:
        _bersihkan(db, [])
        db.close()


def test_edit_nota_terposting_menjadi_nota_tambahan_dan_tolak_ubah():
    db = SessionLocal()
    nomor = []
    try:
        sp = _sp(db)
        svc = TransaksiBengkelService(db)
        t = svc.create(_payload(sp, 1, jasa=[("Servis uji", "5000")]), user_id=None)
        nomor.append(t.nomor_transaksi)
        t = db.get(TransaksiPenjualanBengkel, t.id)
        t.tanggal = date(TAHUN_UJI, BULAN_UJI, 15)  # nota "lama"
        db.commit()
        grand_awal, hpp_awal = t.grand_total, t.hpp_parts
        PeriodePostingService(db).posting(TAHUN_UJI, BULAN_UJI, None)

        # 1. Penambahan item -> nota tambahan di periode terbuka (hari ini)
        edit = _payload(sp, 3, jasa=[("Servis uji", "5000"), ("Jasa susulan", "7000")])
        hasil = svc.update(t.id, edit, user_id=None)
        assert hasil.nota_tambahan_nomor
        nomor.append(hasil.nota_tambahan_nomor)
        db.expire_all()
        asal = db.get(TransaksiPenjualanBengkel, t.id)
        assert asal.grand_total == grand_awal and asal.hpp_parts == hpp_awal
        assert asal.tanggal == date(TAHUN_UJI, BULAN_UJI, 15)
        tambahan = svc.get_by_nomor(hasil.nota_tambahan_nomor)
        assert tambahan.induk_nomor == asal.nomor_transaksi
        assert tambahan.tanggal == date.today()
        assert sum(d.qty for d in tambahan.detail_parts) == 2  # 3 - 1
        assert [d.nama_jasa for d in tambahan.detail_services] == ["Jasa susulan"]
        assert tambahan.grand_total == Decimal("2") * Decimal("10000") + Decimal("7000")

        # 2. Mengurangi / menghapus item lama ditolak
        with pytest.raises(HTTPException) as exc:
            svc.update(t.id, _payload(sp, 0, jasa=[("Servis uji", "5000")]), user_id=None)
        assert exc.value.status_code == 409
        # 3. Diskon diubah ditolak
        with pytest.raises(HTTPException) as exc:
            svc.update(t.id, _payload(sp, 1, jasa=[("Servis uji", "5000")], diskon=Decimal("1000")), user_id=None)
        assert exc.value.status_code == 409
        # 4. Pembatalan nota di periode terposting ditolak
        with pytest.raises(HTTPException) as exc:
            svc.void_transaction(t.id, "uji tolak pembatalan")
        assert exc.value.status_code == 409
        # 5. Tanpa penambahan, edit non-item (status) tetap lewat alur biasa
        ok = svc.update(
            t.id,
            _payload(sp, 1, jasa=[("Servis uji", "5000")], status_pengerjaan=WorkshopStatus.PROSES, catatan="ubah catatan"),
            user_id=None,
        )
        assert ok.nota_tambahan_nomor is None and ok.catatan == "ubah catatan"
        assert ok.grand_total == grand_awal
    finally:
        _bersihkan(db, nomor)
        db.close()


def test_buka_kembali_mengizinkan_edit_dan_nota_baru_ditolak_di_periode_terkunci():
    db = SessionLocal()
    nomor = []
    try:
        sp = _sp(db)
        svc = TransaksiBengkelService(db)
        t = svc.create(_payload(sp, 1), user_id=None)
        nomor.append(t.nomor_transaksi)
        t = db.get(TransaksiPenjualanBengkel if False else TransaksiPenjualanBengkel, t.id)
        t.tanggal = date(TAHUN_UJI, BULAN_UJI, 10)
        db.commit()
        periode = PeriodePostingService(db)
        periode.posting(TAHUN_UJI, BULAN_UJI, None)
        with pytest.raises(HTTPException):
            svc.update(t.id, _payload(sp, 0), user_id=None)
        periode.buka_kembali(TAHUN_UJI, BULAN_UJI, None, "alasan uji buka")
        diubah = svc.update(t.id, _payload(sp, 2), user_id=None)  # bebas lagi
        assert diubah.nota_tambahan_nomor is None
        assert sum(d.qty for d in diubah.detail_parts) == 2

        # Bulan berjalan terkunci (disisipkan langsung): nota baru ditolak
        hari_ini = date.today()
        db.add(PeriodePosting(tahun=hari_ini.year, bulan=hari_ini.month, status="DIPOSTING"))
        db.commit()
        try:
            with pytest.raises(HTTPException) as exc:
                svc.create(_payload(sp, 1), user_id=None)
            assert exc.value.status_code == 409
        finally:
            db.query(PeriodePosting).filter(
                PeriodePosting.tahun == hari_ini.year, PeriodePosting.bulan == hari_ini.month
            ).delete(synchronize_session=False)
            db.commit()
    finally:
        _bersihkan(db, nomor)
        db.close()


def test_skrip_pindah_baris_ke_nota_tambahan_menjaga_stok_dan_total(tmp_path):
    import csv
    import importlib.util
    import os

    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts", "pindah_baris_ke_nota_tambahan.py")
    spec = importlib.util.spec_from_file_location("pindah_baris_ke_nota_tambahan", path)
    modul = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modul)

    db = SessionLocal()
    nomor = []
    try:
        sps = db.query(SparePart).filter(SparePart.deleted_at.is_(None), SparePart.stok > 10).limit(2).all()
        if len(sps) < 2:
            pytest.skip("tidak ada 2 sparepart stok cukup")
        a, b = sps
        svc = TransaksiBengkelService(db)
        t = svc.create(
            _payload(a, 1, detail_parts=[
                DetailPartCreate(spare_part_id=a.id, qty=1, harga_jual=Decimal("10000")),
                DetailPartCreate(spare_part_id=b.id, qty=2, harga_jual=Decimal("7000")),
            ]),
            user_id=None,
        )
        nomor.append(t.nomor_transaksi)
        stok_awal = {s.id: s.stok for s in (db.get(SparePart, a.id), db.get(SparePart, b.id))}
        grand_awal = t.grand_total
        hpp_awal = t.hpp_parts

        berkas = tmp_path / "pindah.csv"
        with open(berkas, "w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(["nota", "item_dump", "qty", "penjualan", "hpp", "tgl_excel", "status"])
            w.writerow([t.nomor_transaksi, b.nama, "2", "14000", "0", "1", "COCOK"])
        bulan = date.today().strftime("%Y-%m")

        # Dry-run: tidak ada perubahan
        modul.jalankan(db, str(berkas), bulan, "bulan", apply=False)
        db.expire_all()
        assert len(svc.get_by_nomor(t.nomor_transaksi).detail_parts) == 2

        modul.jalankan(db, str(berkas), bulan, "bulan", apply=True)
        db.expire_all()
        asal = svc.get_by_nomor(t.nomor_transaksi)
        anak = db.query(TransaksiPenjualanBengkel).filter(
            TransaksiPenjualanBengkel.induk_nomor == t.nomor_transaksi
        ).all()
        assert len(anak) == 1
        nomor.append(anak[0].nomor_transaksi)
        assert [d.spare_part_id for d in asal.detail_parts] == [a.id]
        assert [d.spare_part_id for d in anak[0].detail_parts] == [b.id]
        assert anak[0].tanggal == date.today().replace(day=1)
        assert asal.grand_total + anak[0].grand_total == grand_awal
        assert asal.hpp_parts + anak[0].hpp_parts == hpp_awal
        for sid, stok in stok_awal.items():
            assert db.get(SparePart, sid).stok == stok  # stok tidak berubah
    finally:
        _bersihkan(db, nomor)
        db.close()


def test_antrian_menyembunyikan_nota_tambahan_termasuk_hitungan():
    db = SessionLocal()
    nomor = []
    try:
        sp = _sp(db)
        svc = TransaksiBengkelService(db)
        induk = svc.create(_payload(sp, 1, jasa=[("Servis antrian uji", "5000")]), user_id=None)
        nomor.append(induk.nomor_transaksi)
        anak = svc.create(_payload(sp, 1, jasa=[("Susulan antrian uji", "5000")]), user_id=None)
        nomor.append(anak.nomor_transaksi)
        anak_row = db.get(TransaksiPenjualanBengkel, anak.id)
        anak_row.induk_nomor = induk.nomor_transaksi
        db.commit()

        nomor_dengan = [r.nomor_transaksi for r in svc.get_list(limit=500, search="UJI", sembunyikan_tambahan=False)["data"]]
        nomor_tanpa = svc.get_list(limit=500, search="UJI", sembunyikan_tambahan=True)
        daftar_tanpa = [r.nomor_transaksi for r in nomor_tanpa["data"]]
        assert anak.nomor_transaksi in nomor_dengan
        assert anak.nomor_transaksi not in daftar_tanpa
        assert induk.nomor_transaksi in daftar_tanpa
    finally:
        _bersihkan(db, nomor)
        db.close()


def test_edit_nota_terkunci_lalu_bayar_tidak_error():
    """Urutan layar Update: edit nota periode terkunci (+part), lalu pembayaran pada nota asal."""
    from app.schemas.bengkel import PaymentItem
    from app.utils.constants import PaymentMethod as PM

    db = SessionLocal()
    nomor = []
    try:
        sp = _sp(db)
        svc = TransaksiBengkelService(db)
        t = svc.create(_payload(sp, 1, jasa=[("Servis bayar uji", "20000")], jumlah_bayar=Decimal("0")), user_id=None)
        nomor.append(t.nomor_transaksi)
        t = db.get(TransaksiPenjualanBengkel, t.id)
        t.tanggal = date(TAHUN_UJI, BULAN_UJI, 20)
        db.commit()
        PeriodePostingService(db).posting(TAHUN_UJI, BULAN_UJI, None)
        stok_awal = db.get(SparePart, sp.id).stok

        edit = _payload(sp, 2, jasa=[("Servis bayar uji", "20000")])
        hasil = svc.update(t.id, edit, user_id=None)
        assert hasil.nota_tambahan_nomor
        nomor.append(hasil.nota_tambahan_nomor)
        db.expire_all()
        assert db.get(SparePart, sp.id).stok == stok_awal - 1  # nota tambahan memotong 1 unit
        asal = svc.get_by_nomor(t.nomor_transaksi)
        assert asal.status_bayar == t.status_bayar

        # Pembayaran pada nota asal yang sudah terkunci harus tetap bisa dicatat (tanpa error)
        svc.update_payment(
            asal.id,
            jumlah_bayar=Decimal("5000"),
            metode_bayar=PM.TUNAI,
            payments=[PaymentItem(metode=PM.TUNAI, jumlah=Decimal("5000"))],
            user_id=None,
        )
    finally:
        _bersihkan(db, nomor)
        db.close()


def test_edit_nota_terkunci_dengan_ubah_status_selesai():
    """Edit nota terkunci + tambah part + status SELESAI dalam satu submit (urutan layar Update)."""
    db = SessionLocal()
    nomor = []
    try:
        sp = _sp(db)
        svc = TransaksiBengkelService(db)
        t = svc.create(_payload(sp, 1, jasa=[("Servis selesai uji", "20000")]), user_id=None)
        nomor.append(t.nomor_transaksi)
        t = db.get(TransaksiPenjualanBengkel, t.id)
        t.tanggal = date(TAHUN_UJI, BULAN_UJI, 21)
        db.commit()
        PeriodePostingService(db).posting(TAHUN_UJI, BULAN_UJI, None)
        stok_awal = db.get(SparePart, sp.id).stok

        edit = _payload(sp, 2, jasa=[("Servis selesai uji", "20000")], status_pengerjaan=WorkshopStatus.SELESAI)
        hasil = svc.update(t.id, edit, user_id=None)
        nomor.append(hasil.nota_tambahan_nomor)
        db.expire_all()
        assert db.get(SparePart, sp.id).stok == stok_awal - 1
    finally:
        _bersihkan(db, nomor)
        db.close()


def test_update_diulang_tidak_menggandakan_nota_tambahan():
    """Update yang sama dikirim dua kali ke nota terkunci hanya boleh membuat satu nota tambahan."""
    db = SessionLocal()
    nomor = []
    try:
        sp = _sp(db)
        svc = TransaksiBengkelService(db)
        t = svc.create(_payload(sp, 1, jasa=[("Servis ulang uji", "20000")]), user_id=None)
        nomor.append(t.nomor_transaksi)
        t = db.get(TransaksiPenjualanBengkel, t.id)
        t.tanggal = date(TAHUN_UJI, BULAN_UJI, 22)
        db.commit()
        PeriodePostingService(db).posting(TAHUN_UJI, BULAN_UJI, None)
        stok_awal = db.get(SparePart, sp.id).stok

        edit = _payload(sp, 2, jasa=[("Servis ulang uji", "20000")])
        pertama = svc.update(t.id, edit, user_id=None)
        assert pertama.nota_tambahan_nomor
        nomor.append(pertama.nota_tambahan_nomor)
        # Frontend memuat ulang nota asal (tanpa item tambahan) lalu mengirim ulang payload yang sama
        kedua = svc.update(t.id, _payload(sp, 2, jasa=[("Servis ulang uji", "20000")]), user_id=None)
        assert kedua.nota_tambahan_nomor is None or kedua.nota_tambahan_nomor == pertama.nota_tambahan_nomor
        db.expire_all()
        anak = db.query(TransaksiPenjualanBengkel).filter(
            TransaksiPenjualanBengkel.induk_nomor == t.nomor_transaksi
        ).all()
        assert len(anak) == 1
        assert db.get(SparePart, sp.id).stok == stok_awal - 1  # hanya satu unit terpotong
        asal = svc.get_by_nomor(t.nomor_transaksi)
        assert [d.spare_part_id for d in asal.detail_parts] == [sp.id]
        assert sum(d.qty for d in asal.detail_parts) == 1  # nota asal tidak ditulis ulang
    finally:
        _bersihkan(db, nomor)
        db.close()


def test_detail_nota_induk_memuat_nota_tambahan():
    db = SessionLocal()
    nomor = []
    try:
        sp = _sp(db)
        svc = TransaksiBengkelService(db)
        t = svc.create(_payload(sp, 1, jasa=[("Servis detail uji", "20000")]), user_id=None)
        nomor.append(t.nomor_transaksi)
        t = db.get(TransaksiPenjualanBengkel, t.id)
        t.tanggal = date(TAHUN_UJI, BULAN_UJI, 23)
        db.commit()
        PeriodePostingService(db).posting(TAHUN_UJI, BULAN_UJI, None)
        hasil = svc.update(t.id, _payload(sp, 2, jasa=[("Servis detail uji", "20000")]), user_id=None)
        nomor.append(hasil.nota_tambahan_nomor)

        induk = svc.get_by_id(t.id)
        assert [a["nomor_transaksi"] for a in induk.nota_tambahan] == [hasil.nota_tambahan_nomor]
        bagian = induk.nota_tambahan[0]
        assert len(bagian["detail_parts"]) == 1 and bagian["detail_parts"][0]["qty"] == 1
        assert bagian["detail_parts"][0]["spare_part_nama"]
        anak = svc.get_by_nomor(hasil.nota_tambahan_nomor)
        detail_anak = svc.get_by_id(anak.id)
        assert detail_anak.induk_nomor == t.nomor_transaksi
    finally:
        _bersihkan(db, nomor)
        db.close()
