"""Faktur penjualan mobil (A4) dengan kotak materai, dibuat dengan reportlab."""

from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas

from app.utils.terbilang import terbilang

PERUSAHAAN = {
    "nama": "TIGA PUTRA MOTOR",
    "alamat": "Jl. Raya Cianjur Sukabumi KM 5, Cianjur",
    "telepon": "HP: 087720225244",
}
MATERAI_CM = 3.0  # sisi kotak materai Rp10.000 (ditempel dan ditandatangani di atasnya)


def _rupiah(nilai) -> str:
    return f"Rp {int(round(float(nilai))):,}".replace(",", ".")


def build_faktur_pdf(transaksi, mobil) -> bytes:
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4, pageCompression=0)
    w, h = A4
    kiri = 2.0 * cm
    kanan = w - 2.0 * cm

    # Kop perusahaan
    c.setFont("Helvetica-Bold", 16)
    c.drawString(kiri, h - 2.0 * cm, PERUSAHAAN["nama"])
    c.setFont("Helvetica", 9)
    c.drawString(kiri, h - 2.5 * cm, PERUSAHAAN["alamat"])
    c.drawString(kiri, h - 2.9 * cm, PERUSAHAAN["telepon"])
    c.setLineWidth(1)
    c.line(kiri, h - 3.2 * cm, kanan, h - 3.2 * cm)

    # Judul dan nomor
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(w / 2, h - 4.2 * cm, "FAKTUR PENJUALAN / KWITANSI")
    c.setFont("Helvetica", 10)
    c.drawString(kiri, h - 5.2 * cm, f"No. Faktur : {transaksi.nomor_transaksi}")
    c.drawString(kiri, h - 5.7 * cm, f"Tanggal    : {transaksi.tanggal.strftime('%d-%m-%Y')}")

    # Pembeli
    c.drawString(kiri, h - 6.7 * cm, f"Telah diterima dari : {transaksi.nama_pembeli}")
    c.drawString(kiri, h - 7.2 * cm, f"Telepon             : {transaksi.telepon_pembeli or '-'}")
    c.drawString(kiri, h - 7.7 * cm, f"Alamat              : {transaksi.alamat_pembeli or '-'}")

    # Rincian mobil
    y = h - 9.0 * cm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(kiri, y, "Uraian")
    c.drawRightString(kanan, y, "Jumlah")
    c.line(kiri, y - 0.2 * cm, kanan, y - 0.2 * cm)
    c.setFont("Helvetica", 10)
    baris = [
        f"{mobil.merek} {mobil.model} {mobil.tahun}, warna {mobil.warna}",
        f"Nomor polisi: {mobil.nomor_plat}",
        f"No. rangka: {mobil.nomor_rangka or '-'}   No. mesin: {mobil.nomor_mesin or '-'}",
    ]
    y -= 0.7 * cm
    for teks in baris:
        c.drawString(kiri, y, teks)
        y -= 0.5 * cm
    y -= 0.2 * cm
    c.drawString(kiri, y, "Harga jual")
    c.drawRightString(kanan, y, _rupiah(transaksi.harga_jual))
    y -= 0.5 * cm
    c.drawString(kiri, y, f"Uang muka (DP): {_rupiah(transaksi.dp or 0)}")
    y -= 0.5 * cm
    c.drawString(kiri, y, f"Sisa pembayaran: {_rupiah(transaksi.sisa_bayar or 0)}")

    # Total dan terbilang
    y -= 0.9 * cm
    c.line(kiri, y + 0.4 * cm, kanan, y + 0.4 * cm)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(kiri, y, "Total")
    c.drawRightString(kanan, y, _rupiah(transaksi.harga_jual))
    y -= 0.7 * cm
    c.setFont("Helvetica-Oblique", 10)
    kalimat = terbilang(int(round(float(transaksi.harga_jual))))
    c.drawString(kiri, y, f"Terbilang: {kalimat[:1].upper()}{kalimat[1:]} rupiah")

    # Tanda tangan dan kotak materai
    y_ttd = 6.0 * cm
    c.setFont("Helvetica", 10)
    c.drawString(kiri, y_ttd + 2.8 * cm, "Pembeli")
    c.drawString(kiri, y_ttd, "(                              )")
    c.drawString(kanan - 6.0 * cm, y_ttd + 2.8 * cm, "Penjual")
    c.drawString(kanan - 6.0 * cm, y_ttd, "(                              )")

    # Kotak materai di atas tanda tangan penjual
    sisi = MATERAI_CM * cm
    x_m = kanan - 6.0 * cm
    y_m = y_ttd + 3.6 * cm
    c.setDash(3, 2)
    c.rect(x_m, y_m, sisi, sisi)
    c.setDash()
    c.setFont("Helvetica", 7)
    c.drawCentredString(x_m + sisi / 2, y_m + sisi / 2 - 0.1 * cm, "MATERAI")
    c.drawCentredString(x_m + sisi / 2, y_m + sisi / 2 - 0.4 * cm, "Rp10.000")

    c.setFont("Helvetica", 8)
    c.drawString(kiri, 1.5 * cm, f"Dicetak: {transaksi.tanggal.strftime('%d-%m-%Y')} - {transaksi.nomor_transaksi}")
    c.showPage()
    c.save()
    return buf.getvalue()
