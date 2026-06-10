import re

with open(r"c:\laragon\www\tpm\backend\app\services\reports\base.py", "r", encoding="utf-8") as f:
    content = f.read()

# We need to find where customer_dp is calculated and add bengkel_dp
pattern_customer_dp = r"""        customer_dp = float\(self\.db\.query\(func\.sum\(TransaksiPenjualanMobil\.dp\)\)\.join\(Mobil\)\.filter\(\s*TransaksiPenjualanMobil\.tanggal <= tanggal_sampai,\s*TransaksiPenjualanMobil\.status_bayar != PaymentStatus\.LUNAS,\s*TransaksiPenjualanMobil\.status_bayar != PaymentStatus\.BATAL,\s*or_\(\s*Mobil\.status != CarStatus\.TERJUAL,\s*Mobil\.tanggal_terjual > tanggal_sampai\s*\)\s*\)\.scalar\(\) or 0\)"""

bengkel_dp_code = """        bengkel_dp = float(self.db.query(func.sum(PembayaranPiutang.nominal)).join(PiutangUsaha).join(
            TransaksiPenjualanBengkel, PiutangUsaha.referensi_id == TransaksiPenjualanBengkel.id
        ).filter(
            PembayaranPiutang.tanggal <= tanggal_sampai,
            PiutangUsaha.sumber == PiutangSource.BENGKEL,
            TransaksiPenjualanBengkel.status_pengerjaan != WorkshopStatus.SELESAI,
            TransaksiPenjualanBengkel.status_bayar != PaymentStatus.BATAL
        ).scalar() or 0)
        
        customer_dp += bengkel_dp"""

if "bengkel_dp =" not in content:
    content = re.sub(pattern_customer_dp, lambda m: m.group(0) + "\n\n" + bengkel_dp_code, content)

# Now we find where booking_receivables is calculated and add bengkel_booking_receivables
pattern_booking_receivables = r"""        booking_receivables = float\(self\.db\.query\(func\.sum\(PiutangUsaha\.nominal_piutang\)\)\.select_from\(PiutangUsaha\)\.join\(\s*TransaksiPenjualanMobil, PiutangUsaha\.referensi_id == TransaksiPenjualanMobil\.id\s*\)\.join\(Mobil, TransaksiPenjualanMobil\.mobil_id == Mobil\.id\)\.filter\(\s*PiutangUsaha\.tanggal <= tanggal_sampai,\s*PiutangUsaha\.status != PiutangStatus\.BATAL,\s*TransaksiPenjualanMobil\.status_bayar != PaymentStatus\.LUNAS,\s*TransaksiPenjualanMobil\.status_bayar != PaymentStatus\.BATAL,\s*or_\(\s*Mobil\.status != CarStatus\.TERJUAL,\s*Mobil\.tanggal_terjual > tanggal_sampai\s*\)\s*\)\.scalar\(\) or 0\)"""

bengkel_booking_receivables_code = """        bengkel_booking_receivables = float(self.db.query(func.sum(PiutangUsaha.nominal_piutang)).select_from(PiutangUsaha).join(
            TransaksiPenjualanBengkel, PiutangUsaha.referensi_id == TransaksiPenjualanBengkel.id
        ).filter(
            PiutangUsaha.tanggal <= tanggal_sampai,
            PiutangUsaha.status != PiutangStatus.BATAL,
            PiutangUsaha.sumber == PiutangSource.BENGKEL,
            TransaksiPenjualanBengkel.status_pengerjaan != WorkshopStatus.SELESAI,
            TransaksiPenjualanBengkel.status_bayar != PaymentStatus.BATAL
        ).scalar() or 0)
        
        booking_receivables += bengkel_booking_receivables"""

if "bengkel_booking_receivables =" not in content:
    content = re.sub(pattern_booking_receivables, lambda m: m.group(0) + "\n\n" + bengkel_booking_receivables_code, content)

# Now find where booking_payments is calculated and add bengkel_dp (since bengkel_booking_payments is exactly bengkel_dp)
pattern_booking_payments = r"""        booking_payments = float\(self\.db\.query\(func\.sum\(PembayaranPiutang\.nominal\)\)\.join\(PiutangUsaha\)\.join\(\s*TransaksiPenjualanMobil, PiutangUsaha\.referensi_id == TransaksiPenjualanMobil\.id\s*\)\.join\(Mobil, TransaksiPenjualanMobil\.mobil_id == Mobil\.id\)\.filter\(\s*PembayaranPiutang\.tanggal <= tanggal_sampai,\s*TransaksiPenjualanMobil\.status_bayar != PaymentStatus\.LUNAS,\s*TransaksiPenjualanMobil\.status_bayar != PaymentStatus\.BATAL,\s*or_\(\s*Mobil\.status != CarStatus\.TERJUAL,\s*Mobil\.tanggal_terjual > tanggal_sampai\s*\)\s*\)\.scalar\(\) or 0\)"""

bengkel_booking_payments_code = """        booking_payments += bengkel_dp"""

if "booking_payments += bengkel_dp" not in content:
    content = re.sub(pattern_booking_payments, lambda m: m.group(0) + "\n\n" + bengkel_booking_payments_code, content)


with open(r"c:\laragon\www\tpm\backend\app\services\reports\base.py", "w", encoding="utf-8") as f:
    f.write(content)

print("Patched base.py")
