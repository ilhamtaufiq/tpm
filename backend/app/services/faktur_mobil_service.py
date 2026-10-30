"""Kwitansi penjualan mobil: setengah A4 landscape (A5 landscape), dengan logo dan kotak materai.

Dibuat dengan reportlab. Koordinat ditulis dari tepi atas (dalam cm) lewat `T()`.
"""

import os
from io import BytesIO

from reportlab.lib.pagesizes import A5, landscape
from reportlab.lib.units import cm
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen import canvas

from app.utils.terbilang import terbilang

PERUSAHAAN = {
    "nama": "TIGA PUTRA MOTOR",
    "alamat": "Jl. Raya Cianjur Sukabumi KM 5, Cianjur",
    "telepon": "HP: 087720225244",
}
LOGO_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "logo_tpm.png")
PAGE = landscape(A5)  # 210 x 148,5 mm


def _rupiah(nilai) -> str:
    return f"Rp {int(round(float(nilai))):,}".replace(",", ".")


def _tulis_terbungkus(c, teks: str, x: float, y: float, lebar: float, font: str, ukuran: int, jarak: float) -> float:
    """Tulis teks dengan pembungkusan kata. Mengembalikan posisi y baris terakhir."""
    c.setFont(font, ukuran)
    for baris in simpleSplit(teks, font, ukuran, lebar):
        c.drawString(x, y, baris)
        y -= jarak
    return y


def build_faktur_pdf(transaksi, mobil) -> bytes:
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=PAGE, pageCompression=0)
    w, h = PAGE
    kiri = 1.2 * cm
    kanan = w - 1.2 * cm

    def T(baris_cm: float) -> float:
        """Koordinat y dari jarak tepi atas dalam cm."""
        return h - baris_cm * cm

    # Kop: logo, nama, dan alamat perusahaan
    logo_sisi = 2.0 * cm
    if os.path.exists(LOGO_PATH):
        c.drawImage(LOGO_PATH, kiri, T(1.0) - logo_sisi, width=logo_sisi, height=logo_sisi,
                    mask="auto", preserveAspectRatio=True)
    x_teks = kiri + 2.4 * cm
    c.setFont("Helvetica-Bold", 12)
    c.drawString(x_teks, T(1.5), PERUSAHAAN["nama"])
    c.setFont("Helvetica", 8)
    c.drawString(x_teks, T(2.0), PERUSAHAAN["alamat"])
    c.drawString(x_teks, T(2.45), PERUSAHAAN["telepon"])

    # Judul dan nomor di kanan kop
    c.setFont("Helvetica-Bold", 14)
    c.drawRightString(kanan, T(1.5), "KWITANSI")
    c.setFont("Helvetica", 9)
    c.drawRightString(kanan, T(2.0), f"No. : {transaksi.nomor_transaksi}")
    c.drawRightString(kanan, T(2.45), f"Tanggal : {transaksi.tanggal.strftime('%d-%m-%Y')}")

    c.setLineWidth(0.8)
    c.line(kiri, T(3.4), kanan, T(3.4))

    # Isi kiri: pembeli, nilai terbilang, dan keterangan
    lbl_x = kiri
    val_x = kiri + 3.0 * cm
    val_lebar = 12.0 * cm - val_x
    c.setFont("Helvetica", 9)
    c.drawString(lbl_x, T(4.1), "Telah diterima dari")
    c.drawString(val_x - 0.2 * cm, T(4.1), f": {transaksi.nama_pembeli}")
    c.drawString(lbl_x, T(4.7), "Alamat")
    c.drawString(val_x - 0.2 * cm, T(4.7), f": {transaksi.alamat_pembeli or '-'}")
    c.drawString(lbl_x, T(5.3), "Telepon")
    c.drawString(val_x - 0.2 * cm, T(5.3), f": {transaksi.telepon_pembeli or '-'}")

    kalimat = terbilang(int(round(float(transaksi.harga_jual))))
    y = _tulis_terbungkus(c, f"Uang sejumlah : {kalimat[:1].upper()}{kalimat[1:]} rupiah",
                          lbl_x, T(6.0), 12.0 * cm - lbl_x, "Helvetica-Oblique", 9, 0.45 * cm)

    keterangan = (
        f"Untuk pembayaran : mobil {mobil.merek} {mobil.model} {mobil.tahun}, warna {mobil.warna}"
        f", nomor polisi {mobil.nomor_plat}, no. rangka {mobil.nomor_rangka or '-'}"
        f", no. mesin {mobil.nomor_mesin or '-'}"
    )
    _tulis_terbungkus(c, keterangan, lbl_x, y - 0.1 * cm, 12.0 * cm - lbl_x, "Helvetica", 8, 0.4 * cm)

    # Kotak jumlah di kanan
    box_x = 12.8 * cm
    box_w = kanan - box_x
    box_top = 4.1
    box_h = 2.6
    c.setLineWidth(0.8)
    c.rect(box_x, T(box_top + box_h), box_w, box_h * cm, stroke=1, fill=0)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(box_x + 0.3 * cm, T(box_top + 0.6), "Jumlah")
    c.setFont("Helvetica-Bold", 13)
    c.drawRightString(kanan - 0.3 * cm, T(box_top + 0.7), _rupiah(transaksi.harga_jual))
    c.setLineWidth(0.4)
    c.line(box_x + 0.3 * cm, T(box_top + 1.05), kanan - 0.3 * cm, T(box_top + 1.05))
    c.setFont("Helvetica", 8)
    c.drawString(box_x + 0.3 * cm, T(box_top + 1.5), "Uang muka (DP)")
    c.drawRightString(kanan - 0.3 * cm, T(box_top + 1.5), _rupiah(transaksi.dp or 0))
    c.drawString(box_x + 0.3 * cm, T(box_top + 2.0), "Sisa pembayaran")
    c.drawRightString(kanan - 0.3 * cm, T(box_top + 2.0), _rupiah(transaksi.sisa_bayar or 0))

    # Tanda tangan: pembeli di kiri, penjual di kanan dengan kotak materai di atasnya
    cx_pembeli = kiri + 2.8 * cm
    cx_penjual = kanan - 2.8 * cm
    c.setFont("Helvetica", 9)
    c.drawCentredString(cx_pembeli, T(9.6), "Pembeli")
    c.drawCentredString(cx_penjual, T(9.6), "Penjual")

    # Tempat materai Rp10.000 di antara label Penjual dan garis tanda tangan, tanpa bingkai
    c.setFont("Helvetica", 6)
    c.drawCentredString(cx_penjual, T(11.3), "Materai Rp10.000")

    c.setFont("Helvetica", 9)
    c.drawCentredString(cx_pembeli, T(13.0), "(                          )")
    c.drawCentredString(cx_penjual, T(13.0), "(                          )")

    # Catatan cetak di bawah
    c.setFont("Helvetica", 7)
    c.drawString(kiri, T(14.1), f"Dicetak: {transaksi.tanggal.strftime('%d-%m-%Y')} - {transaksi.nomor_transaksi}")

    c.showPage()
    c.save()
    return buf.getvalue()
