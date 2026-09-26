"""Script healing data otomatis untuk server/production.

Memeriksa dan menyuntikkan entri KasBank MASUK yang hilang untuk PembayaranPiutang,
lalu merebuild saldo rantai KasBank. Safe & Idempotent (aman dijalankan berulang).

Jalankan di server:
  python heal_missing_kasbank.py
  atau:
  docker compose exec backend python heal_missing_kasbank.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models.keuangan import KasBank, PembayaranPiutang, PiutangUsaha
from app.utils.constants import KasBankType, KasBankSource, KasBankJenis, PiutangSource
from app.services.kas_bank_service import KasBankService
from app.services.kas_bank_integration import create_kas_entry


def heal_missing_kasbank():
    db = SessionLocal()
    try:
        print("=== CEK & HEAL KASBANK MASUK YANG HILANG ===")
        injected_count = 0
        total_injected_nominal = 0.0

        pbs = db.query(PembayaranPiutang).all()
        for pb in pbs:
            ptg = db.query(PiutangUsaha).filter(PiutangUsaha.id == pb.piutang_id).first()
            if not ptg:
                continue

            # Cek apakah entri KasBank MASUK sudah ada untuk pembayaran ini
            kb_exist = db.query(KasBank).filter(
                KasBank.tipe == KasBankType.MASUK,
                KasBank.nominal == pb.nominal,
                KasBank.tanggal == pb.tanggal,
                KasBank.nomor_referensi == ptg.nomor_piutang,
            ).first()

            if not kb_exist:
                # Tentukan wallet kas/bank
                if pb.metode_bayar and str(pb.metode_bayar).upper() == "TRANSFER":
                    kas_jenis = KasBankJenis.BANK_UTAMA
                else:
                    kas_jenis = KasBankJenis.KAS_UTAMA

                # Tentukan unit sumber
                if ptg.unit:
                    sumber = ptg.unit
                    unit_label = ptg.unit.value.replace("KAS_UNIT_", "").replace("_", " ").title()
                elif ptg.sumber == PiutangSource.BENGKEL:
                    sumber = KasBankSource.BENGKEL
                    unit_label = "Bengkel"
                elif ptg.sumber == PiutangSource.JASA_ANGKUT:
                    sumber = KasBankSource.JASA_ANGKUT
                    unit_label = "Jasa Angkut"
                elif ptg.sumber == PiutangSource.JUAL_BELI_MOBIL:
                    sumber = KasBankSource.JUAL_BELI_MOBIL
                    unit_label = "Mobil"
                else:
                    sumber = KasBankSource.PIUTANG
                    unit_label = "Piutang"

                metode_str = str(pb.metode_bayar.value if hasattr(pb.metode_bayar, "value") else pb.metode_bayar).upper()

                create_kas_entry(
                    db=db,
                    tanggal=pb.tanggal,
                    tipe=KasBankType.MASUK,
                    nominal=float(pb.nominal),
                    sumber=sumber,
                    metode_bayar=metode_str,
                    referensi_id=pb.id,
                    nomor_referensi=ptg.nomor_piutang,
                    keterangan=f"[{unit_label}] Pelunasan piutang {ptg.nomor_piutang} - {ptg.nama_debitur} ({metode_str})",
                    user_id=pb.created_by or 1,
                    kas_jenis=kas_jenis,
                )
                injected_count += 1
                total_injected_nominal += float(pb.nominal)
                print(f"HEALED: PB#{pb.id} tgl={pb.tanggal} nominal=Rp {pb.nominal:,.0f} ptg={ptg.nomor_piutang} ({kas_jenis.name})")

        if injected_count > 0:
            db.commit()
            print(f"\nBerhasil menyuntik {injected_count} transaksi kas masuk (Total Rp {total_injected_nominal:,.0f}).")
            print("Memulai Rebuild Saldo KasBank...")
            kb_svc = KasBankService(db)
            for jenis in KasBankJenis:
                kb_svc.rebuild_balances(jenis)
            db.commit()
            print("Rebuild Saldo Selesai 100%.")
        else:
            print("Semua data KasBank MASUK sudah lengkap. Tidak ada data yang hilang.")

    except Exception as e:
        db.rollback()
        print(f"Error heal KasBank: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    heal_missing_kasbank()
