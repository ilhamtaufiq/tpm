"""
Public Receipt API Endpoints
Accessible without authentication for QR code scanning
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.orm import Session, joinedload
from typing import Dict, Any, Optional
from datetime import datetime
import io
import os
from PIL import Image, ImageDraw, ImageFont, ImageOps
from fastapi.responses import HTMLResponse, Response, StreamingResponse
import json
import re
import base64

from app.database.connection import get_db
from app.models.bengkel import TransaksiPenjualanBengkel
from app.models.jasa_angkut import MuatanJasaAngkut
from app.models.mobil import Mobil, TransaksiPenjualanMobil
from app.models.system_setting import SystemSetting
from app.services.short_link_service import ShortLinkService

router = APIRouter(prefix="/public/receipt", tags=["Public Receipt"])


@router.get("/{receipt_type}/{transaction_id}")
async def get_receipt(
    receipt_type: str, 
    transaction_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get receipt data by public receipt token
    Supports: bengkel, jasa_angkut, mobil
    
    Example: GET /public/receipt/bengkel/{token}
    """
    
    if receipt_type not in ["bengkel", "jasa_angkut", "mobil"]:
        raise HTTPException(status_code=400, detail="Invalid receipt type")
    
    try:
        if receipt_type == "bengkel":
            return get_bengkel_receipt(db, transaction_id)
        elif receipt_type == "jasa_angkut":
            return get_jasa_angkut_receipt(db, transaction_id)
        else:
            return get_mobil_receipt(db, transaction_id)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching receipt: {e}")
        raise HTTPException(status_code=404, detail="Receipt not found")


def format_payment_method(method: str) -> str:
    """Format raw payment method string to human-readable text"""
    if not method: return "-"

    # Handle enum-like strings (e.g. PAYMENTMETHOD.SPLIT)
    formatted = str(method).split('.')[-1].upper()

    mapping = {
        "SPLIT": "GABUNGAN",
        "TUNAI": "TUNAI",
        "TRANSFER": "TRANSFER / QRIS",
        "DEBIT": "KARTU DEBIT",
        "KREDIT": "KARTU KREDIT",
        "PIUTANG": "BON / PIUTANG"
    }

    return mapping.get(formatted, formatted)


def resolve_payment_display(db: Session, nomor_transaksi: str, metode_bayar, paid: float, remaining: float) -> Dict[str, Any]:
    """Resolve which payment method(s) a receipt may show.

    Rules:
    - BELUM BAYAR (paid <= 0): no method shown at all.
    - BELUM LUNAS (remaining > 0, paid > 0): show the ACTUAL methods used so
      far, read from KasBank MASUK entries (split-aware). Falls back to the
      transaction's metode_bayar when no kas entries exist yet.
    - LUNAS: show actual methods from KasBank (split-aware), fallback to
      transaction metode_bayar.
    """
    from app.models.keuangan import KasBank
    from app.utils.constants import KasBankType

    paid = float(paid or 0)
    remaining = float(remaining or 0)

    methods: list = []
    if paid > 0:
        rows = db.query(KasBank).filter(
            KasBank.nomor_referensi == nomor_transaksi,
            KasBank.tipe == KasBankType.MASUK,
        ).all()
        seen: Dict[str, float] = {}
        for r in rows:
            label = format_payment_method(getattr(r.metode_bayar, "value", r.metode_bayar))
            seen[label] = seen.get(label, 0) + float(r.nominal or 0)
        methods = [{"metode": k, "nominal": v} for k, v in seen.items() if v > 0]

    if not methods and paid > 0 and metode_bayar:
        # Fallback: single method stored on the transaction itself
        methods = [{"metode": format_payment_method(getattr(metode_bayar, "value", metode_bayar)), "nominal": paid}]

    if paid <= 0:
        payment_method = None
    elif len(methods) > 1:
        payment_method = "GABUNGAN"
    elif methods:
        payment_method = methods[0]["metode"]
    else:
        payment_method = None

    return {"paymentMethod": payment_method, "paymentMethods": methods}


def apply_branding(db: Session, receipt: Dict[str, Any]):
    """Apply system branding settings to receipt data"""
    try:
        print_setting = db.query(SystemSetting).filter(SystemSetting.key == "print_config").first()
        if print_setting and print_setting.value:
            config = json.loads(print_setting.value)
            receipt["companyName"] = config.get("company_name", receipt.get("companyName", "Tiga Putra Motor"))
            receipt["companyAddress"] = config.get("company_address", receipt.get("companyAddress", "Cianjur, Jawa Barat"))
            receipt["companyPhone"] = config.get("company_phone", receipt.get("companyPhone", "+62 856 5999 4407"))
            receipt["customHeader"] = config.get("header")
            receipt["customFooter"] = config.get("footer")
            receipt["showQRCode"] = config.get("show_qr_code", True)
            receipt["paperSize"] = config.get("paper_size", "80mm")
            # Store custom logo if available
            if config.get("logo_uri"):
                receipt["customLogo"] = config.get("logo_uri")
    except Exception as e:
        print(f"Error applying branding: {e}")
    
    return receipt


def get_bengkel_receipt(db: Session, transaction_id: str) -> Dict[str, Any]:
    """Get Bengkel receipt"""
    
    # Public workshop receipts must be addressed by an unguessable token, not
    # by the internal sequential database ID.
    transaction = db.query(TransaksiPenjualanBengkel).options(
        joinedload(TransaksiPenjualanBengkel.detail_services),
        joinedload(TransaksiPenjualanBengkel.detail_parts),
    ).filter(
        TransaksiPenjualanBengkel.public_receipt_token == transaction_id
    ).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Build items list from services and parts
    services = []
    parts = []
    
    for service in (transaction.detail_services or []):
        services.append({
            "description": service.nama_jasa,
            "quantity": int(service.qty or 1),
            "unitPrice": float(service.harga),
            "subtotal": float(service.subtotal or service.harga)
        })
    
    for part in (transaction.detail_parts or []):
        parts.append({
            "description": part.spare_part_nama or "Sparepart",
            "quantity": int(part.qty or 1),
            "unitPrice": float(part.harga_jual or 0),
            "subtotal": float(part.subtotal)
        })

    items = services + parts
    
    # Build receipt
    receipt = {
        "transactionNumber": transaction.nomor_transaksi or str(transaction.id),
        "date": transaction.created_at.isoformat() if transaction.created_at else datetime.now().isoformat(),
        "customerName": transaction.nama_customer or "Umum",
        "vehiclePlate": transaction.nomor_plat,
        "vehicleType": transaction.jenis_kendaraan,
        "items": items,
        "services": services,
        "parts": parts,
        "subtotal": float(transaction.subtotal or 0),
        "tax": 0,
        "discount": float(transaction.diskon or 0),
        "showDiscount": bool(getattr(transaction, "tampilkan_diskon_struk", True)),
        "total": float(transaction.grand_total or 0),
        "paid": float(transaction.jumlah_bayar or 0),
        "remaining": float(transaction.grand_total or 0) - float(transaction.jumlah_bayar or 0),
        **resolve_payment_display(
            db,
            transaction.nomor_transaksi,
            transaction.metode_bayar,
            float(transaction.jumlah_bayar or 0),
            float(transaction.grand_total or 0) - float(transaction.jumlah_bayar or 0),
        ),
        "notes": transaction.catatan,
        "companyName": "Tiga Putra Motor",
        "companyAddress": "Cianjur, Jawa Barat",
        "companyPhone": "+62 856 5999 4407"
    }
    
    return apply_branding(db, receipt)


def get_jasa_angkut_receipt(db: Session, transaction_id: str) -> Dict[str, Any]:
    """Get Jasa Angkut receipt"""
    from app.models.keuangan import PiutangUsaha
    from app.utils.constants import PiutangSource
    
    # Get muatan
    muatan = db.query(MuatanJasaAngkut).filter(
        MuatanJasaAngkut.id == int(transaction_id)
    ).first()
    
    if not muatan:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    piutang = db.query(PiutangUsaha).filter(
        PiutangUsaha.referensi_id == muatan.id,
        PiutangUsaha.sumber == PiutangSource.JASA_ANGKUT
    ).first()
    
    paid_amount = float(piutang.total_dibayar) if piutang else (float(muatan.harga_jual) if muatan.status_bayar == 'LUNAS' else 0)
    remaining_amount = float(piutang.sisa_piutang) if piutang else (0 if muatan.status_bayar == 'LUNAS' else float(muatan.harga_jual))
    
    # Build items
    items = [{
        "description": f"Ritase ke-{muatan.ritase}: {muatan.asal} - {muatan.tujuan}",
        "quantity": 1,
        "unitPrice": float(muatan.harga_jual or 0),
        "subtotal": float(muatan.harga_jual or 0)
    }]
    
    # Details for extra info
    plat_nomor = muatan.nopol or (muatan.armada.nopol if muatan.armada else "-")
    details = [
        f"PLAT NOMOR: {plat_nomor}",
        f"SUPIR: {muatan.supir_nama or '-'}",
        f"MUATAN: {muatan.jenis_muatan or '-'}",
        f"SHARE TPM: Rp {float(muatan.laba_tpm or 0):,.0f}",
        f"HAK SUPIR: Rp {float(muatan.laba_supir or 0):,.0f}"
    ]
    
    # Build receipt
    receipt = {
        "transactionNumber": str(muatan.nomor_transaksi),
        "date": muatan.created_at.isoformat() if muatan.created_at else datetime.now().isoformat(),
        "customerName": muatan.supir_nama or "Umum",
        "vehiclePlate": plat_nomor,
        "origin": muatan.asal,
        "destination": muatan.tujuan,
        "driverName": muatan.supir_nama,
        "details": details,
        "items": items,
        "subtotal": float(muatan.harga_jual or 0),
        "tax": 0,
        "discount": 0,
        "total": float(muatan.harga_jual or 0),
        "paid": paid_amount,
        "remaining": remaining_amount,
        **resolve_payment_display(
            db, muatan.nomor_transaksi, "TUNAI", paid_amount, remaining_amount,
        ),
        "notes": muatan.catatan,
        "companyName": "Tiga Putra Motor",
        "companyAddress": "Cianjur, Jawa Barat",
        "companyPhone": "+62 856 5999 4407"
    }
    
    return apply_branding(db, receipt)


def get_mobil_receipt(db: Session, transaction_id: str) -> Dict[str, Any]:
    """Get Mobil receipt"""
    
    transaksi = db.query(TransaksiPenjualanMobil).options(joinedload(TransaksiPenjualanMobil.mobil)).filter(
        TransaksiPenjualanMobil.public_receipt_token == transaction_id
    ).first()
    mobil = transaksi.mobil if transaksi else None
    
    if not mobil or mobil.status.upper() != 'TERJUAL':
        raise HTTPException(status_code=404, detail="Sold car not found")
    
    # Build items
    items = [{
        "description": f"Mobil {mobil.merek} {mobil.model} {mobil.tahun} ({mobil.nomor_plat})",
        "quantity": 1,
        "unitPrice": float(mobil.harga_jual or 0),
        "subtotal": float(mobil.harga_jual or 0)
    }]
    
    # Build receipt
    receipt = {
        "transactionNumber": transaksi.nomor_transaksi,
        "date": transaksi.tanggal.isoformat() if transaksi.tanggal else datetime.now().isoformat(),
        "customerName": transaksi.nama_pembeli or "Umum",
        "items": items,
        "subtotal": float(mobil.harga_jual or 0),
        "tax": 0,
        "discount": 0,
        "total": float(mobil.harga_jual or 0),
        "paid": float((mobil.harga_jual or 0) - (transaksi.sisa_bayar or 0)),
        "remaining": float(transaksi.sisa_bayar or 0),
        **resolve_payment_display(
            db,
            transaksi.nomor_transaksi,
            transaksi.metode_bayar.value if transaksi.metode_bayar else "TUNAI",
            float((mobil.harga_jual or 0) - (transaksi.sisa_bayar or 0)),
            float(transaksi.sisa_bayar or 0),
        ),
        "notes": transaksi.catatan if transaksi.catatan else (mobil.catatan or "-"),
        "companyName": "Tiga Putra Motor",
        "companyAddress": "Cianjur, Jawa Barat",
        "companyPhone": "+62 856 5999 4407"
    }
    
    return apply_branding(db, receipt)


def get_font_path(bold=False):
    """Get system font path, fallback to default"""
    paths = []
    if os.name == 'nt':  # Windows
        font_name = "arialbd.ttf" if bold else "arial.ttf"
        paths.append(os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "Fonts", font_name))
    else:  # Linux/Unix
        font_name = "LiberationSans-Bold.ttf" if bold else "LiberationSans-Regular.ttf"
        paths.extend([
            f"/usr/share/fonts/truetype/liberation/{font_name}",
            f"/usr/share/fonts/TTF/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/TTF/DejaVuSans.ttf",
            f"/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
        ])
    
    for p in paths:
        if os.path.exists(p):
            return p
    return None

def generate_receipt_image(data: Dict[str, Any], public_url: Optional[str] = None, receipt_type: str = "") -> io.BytesIO:
    """Gambar OG struk: kartu biru STRUK DIGITAL, sama dengan halaman server (pratinjau chat)."""
    CW = 800
    CX0, CX1 = 40, 760
    BLUE, BLUE_SOFT = "#023C69", "#1f5a86"
    GRAY, DARK, LINE = "#6b7280", "#111827", "#d1d5db"
    font_path = get_font_path(bold=False)
    bold_path = get_font_path(bold=True)

    def font(size: int, bold: bool = False):
        p = bold_path if bold else font_path
        try:
            return ImageFont.truetype(p, size) if p else ImageFont.load_default()
        except Exception:
            return ImageFont.load_default()

    f_kicker, f_type, f_badge = font(15, True), font(30, True), font(15, True)
    f_company, f_small, f_body, f_body_b, f_total = font(26, True), font(18), font(20), font(20, True), font(26, True)
    f_section = font(16, True)

    tipe_label = {"bengkel": "Bengkel", "jasa_angkut": "Jasa Angkut", "mobil": "Mobil"}.get(receipt_type, "Struk")
    paid = float(data.get("paid", 0) or 0)
    total = float(data.get("total", 0) or 0)
    remaining = float(data.get("remaining", total - paid) or 0)
    lunas = remaining <= 0
    status_text = "LUNAS" if lunas else "BELUM LUNAS"
    discount = float(data.get("discount", 0) or 0)
    metode = str(data.get("paymentMethod") or "").upper()

    if data.get("services") or data.get("parts"):
        groups = []
        if data.get("services"):
            groups.append(("LAYANAN", data["services"]))
        if data.get("parts"):
            groups.append(("SPARE PART", data["parts"]))
    else:
        groups = [(None, data.get("items", []))]

    logo = None
    try:
        static_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "static")
        logo_path = os.path.join(static_dir, "logo_tpm.png")
        if os.path.exists(logo_path):
            logo = Image.open(logo_path).convert("RGBA")
            aspect = logo.width / logo.height
            logo = logo.resize((int(96 * aspect), 96), Image.Resampling.LANCZOS)
    except Exception:
        logo = None

    def trim(text: str, limit: int = 44) -> str:
        text = str(text or "-").upper()
        return text if len(text) <= limit else text[: limit - 3] + "..."

    def render(img, draw, card_bottom: int) -> int:
        # Kartu putih dengan header biru
        y_top = 20
        if card_bottom > y_top:
            draw.rounded_rectangle((CX0, y_top, CX1, card_bottom), radius=28, fill="white", outline=LINE)
        draw.rounded_rectangle((CX0, y_top, CX1, y_top + 110), radius=28, fill=BLUE)
        draw.rectangle((CX0, y_top + 80, CX1, y_top + 110), fill=BLUE)
        draw.text((CX0 + 32, y_top + 24), "STRUK DIGITAL", font=f_kicker, fill="#b8c7d9")
        draw.text((CX0 + 32, y_top + 44), tipe_label, font=f_type, fill="white")
        badge_x1 = CX1 - 32
        badge_x0 = badge_x1 - 170
        draw.rounded_rectangle((badge_x0, y_top + 36, badge_x1, y_top + 72), radius=18, fill=BLUE_SOFT)
        draw.text(((badge_x0 + badge_x1) // 2, y_top + 54), status_text, font=f_badge, fill="white", anchor="mm")

        y = y_top + 140
        judul_struk = f"Struk Transaksi {data.get('transactionNumber', '')} - Tiga Putra Motor"
        total_teks = f"Total : Rp. {total:,.0f}".replace(",", ".")
        draw.text((CW // 2, y), judul_struk, font=f_body_b, fill=DARK, anchor="mt")
        y += 32
        draw.text((CW // 2, y), total_teks, font=f_body, fill=DARK, anchor="mt")
        y += 40
        if logo is not None:
            img.paste(logo, (CW // 2 - logo.width // 2, y), logo)
            y += logo.height + 12
        draw.text((CW // 2, y), data.get("companyName", "Tiga Putra Motor"), font=f_company, fill=DARK, anchor="mt")
        y += 36
        draw.text((CW // 2, y), data.get("companyAddress", ""), font=f_small, fill=GRAY, anchor="mt")
        y += 26
        draw.text((CW // 2, y), f"Telp: {data.get('companyPhone', '')}", font=f_small, fill=GRAY, anchor="mt")
        y += 40

        def dash():
            nonlocal y
            x = CX0 + 32
            while x < CX1 - 32:
                draw.line((x, y, x + 6, y), fill=LINE, width=1)
                x += 10
            y += 22

        def info(label, value, bold=False):
            nonlocal y
            draw.text((CX0 + 32, y), label, font=f_body, fill=GRAY)
            draw.text((CX1 - 32, y), value, font=f_body_b if bold else f_body, fill=DARK, anchor="ra")
            y += 34

        dash()
        info("Nomor Transaksi", str(data.get("transactionNumber", "")), bold=True)
        date_text = data.get("date", "")
        try:
            date_text = datetime.fromisoformat(date_text).strftime("%d/%m/%Y %H:%M")
        except Exception:
            pass
        info("Tanggal", date_text)
        info("Pelanggan", str(data.get("customerName") or "Umum"))
        if data.get("vehiclePlate"):
            info("No. Polisi", str(data["vehiclePlate"]))
        dash()

        for title, items in groups:
            if not items:
                continue
            if title:
                draw.text((CX0 + 32, y), title, font=f_section, fill=GRAY)
                y += 28
            for item in items:
                draw.text((CX0 + 32, y), trim(item.get("description")), font=f_body_b, fill=DARK)
                y += 28
                qty = int(float(item.get("quantity", 1) or 1))
                draw.text((CX0 + 44, y), f"{qty} x {float(item.get('unitPrice', 0) or 0):,.0f}", font=f_body, fill=GRAY)
                draw.text((CX1 - 32, y), f"{float(item.get('subtotal', 0) or 0):,.0f}", font=f_body, fill=DARK, anchor="ra")
                y += 36
            if title:
                sub = sum(float(i.get("subtotal", 0) or 0) for i in items)
                draw.line((CX0 + 32, y, CX1 - 32, y), fill=LINE, width=1)
                y += 10
                draw.text((CX0 + 32, y), "Total", font=f_small, fill=GRAY)
                draw.text((CX1 - 32, y), f"{sub:,.0f}", font=f_body_b, fill=DARK, anchor="ra")
                y += 40
        dash()

        draw.text((CX0 + 32, y), "SUBTOTAL", font=f_body, fill=GRAY)
        draw.text((CX1 - 32, y), f"{float(data.get('subtotal', 0) or 0):,.0f}", font=f_body, fill=DARK, anchor="ra")
        y += 34
        if discount > 0 and data.get("showDiscount", True):
            draw.text((CX0 + 32, y), "DISKON", font=f_body, fill=GRAY)
            draw.text((CX1 - 32, y), f"-{discount:,.0f}", font=f_body, fill=DARK, anchor="ra")
            y += 34
        draw.line((CX0 + 32, y, CX1 - 32, y), fill=DARK, width=2)
        y += 10
        draw.text((CX0 + 32, y), "TOTAL", font=f_total, fill=DARK)
        draw.text((CX1 - 32, y), f"{total:,.0f}", font=f_total, fill=DARK, anchor="ra")
        y += 48
        draw.text((CX0 + 32, y), "SUDAH DIBAYAR", font=f_body, fill=GRAY)
        draw.text((CX1 - 32, y), f"{paid:,.0f}", font=f_body, fill=DARK, anchor="ra")
        y += 34
        draw.text((CX0 + 32, y), "SISA TAGIHAN", font=f_body_b, fill=DARK)
        draw.text((CX1 - 32, y), f"{remaining:,.0f}", font=f_body_b, fill=DARK, anchor="ra")
        y += 34
        if paid > 0 and metode and metode != "NONE":
            draw.text((CX0 + 32, y), "METODE", font=f_body, fill=GRAY)
            draw.text((CX1 - 32, y), metode, font=f_body, fill=DARK, anchor="ra")
            y += 34
        dash()
        draw.text((CW // 2, y), "Terima kasih", font=f_small, fill=GRAY, anchor="mt")
        y += 26
        draw.text((CW // 2, y), f"Layanan pelanggan: {data.get('companyPhone', '')}", font=f_small, fill=GRAY, anchor="mt")
        y += 40
        return y

    measure_img = Image.new("RGB", (CW, 10), "white")
    card_end = render(measure_img, ImageDraw.Draw(measure_img), 0)
    height = card_end + 40 + (50 if public_url else 0)
    img = Image.new("RGB", (CW, height), "#f3f4f6")
    draw = ImageDraw.Draw(img)
    render(img, draw, card_end)
    if public_url:
        url_draw = public_url if len(public_url) <= 64 else public_url[:61] + "..."
        draw.text((CW // 2, card_end + 25), url_draw, font=f_small, fill=BLUE, anchor="mm")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


@router.get("/image/{receipt_type}/{transaction_id}")
async def get_receipt_image(
    receipt_type: str, 
    transaction_id: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Generate dynamic OG / share image for the receipt (PNG).
    Used by WhatsApp / social share and client share-with-image.
    """
    try:
        if receipt_type == "bengkel":
            data = get_bengkel_receipt(db, transaction_id)
        elif receipt_type == "jasa_angkut":
            data = get_jasa_angkut_receipt(db, transaction_id)
        elif receipt_type == "mobil":
            data = get_mobil_receipt(db, transaction_id)
        else:
            raise HTTPException(status_code=400, detail="Invalid receipt type")

        # Prefer app public page URL for share caption on image
        origin = str(request.base_url).rstrip("/")
        # API is usually /api/v1 — public SPA lives on same host without /api
        if origin.endswith("/api/v1") or origin.endswith("/api"):
            origin = origin.rsplit("/api", 1)[0]
        # Link pendek di bawah gambar, supaya URL tidak terlalu panjang.
        try:
            kode = ShortLinkService(db).buat_atau_ambil(receipt_type, transaction_id).kode
            public_url = f"{origin}/s/{kode}"
        except ValueError:
            public_url = f"{origin}/receipt/{receipt_type}/{transaction_id}"
            
        img_buf = generate_receipt_image(data, public_url=public_url, receipt_type=receipt_type)
        return Response(content=img_buf.getvalue(), media_type="image/png")
    except Exception as e:
        print(f"Error generating OG image: {e}")
        # Return a simple placeholder or 404
        raise HTTPException(status_code=404, detail="Image generation failed")


@router.get("/view/{receipt_type}/{transaction_id}", response_class=HTMLResponse)
async def view_receipt(
    receipt_type: str, 
    transaction_id: str,
    db: Session = Depends(get_db)
):
    """
    Public HTML view for the receipt
    """
    try:
        if receipt_type == "bengkel":
            data = get_bengkel_receipt(db, transaction_id)
        elif receipt_type == "jasa_angkut":
            data = get_jasa_angkut_receipt(db, transaction_id)
        elif receipt_type == "mobil":
            data = get_mobil_receipt(db, transaction_id)
        else:
            raise HTTPException(status_code=400, detail="Invalid receipt type")
            
        return generate_html_receipt(data, receipt_type, transaction_id)
    except Exception as e:
        print(f"Error generating public view: {e}")
        return HTMLResponse(content="<div style='text-align:center; padding: 50px;'><h1 style='color:#EE2737;'>Struk tidak ditemukan</h1><p>Pastikan link yang Anda buka sudah benar.</p></div>", status_code=404)

CSS_STRUK = """
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f3f4f6; font-family: Arial, Helvetica, sans-serif; color: #111827; padding: 16px; }
  .card { max-width: 420px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 28px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .header { background: #023C69; color: #fff; padding: 18px 20px; display: flex; justify-content: space-between; align-items: center; }
  .kicker { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; opacity: .7; font-weight: 700; }
  .type { font-size: 18px; font-weight: 700; margin-top: 2px; }
  .badge { background: rgba(255,255,255,.2); padding: 4px 12px; border-radius: 999px; font-size: 10px; font-weight: 700; letter-spacing: 1px; }
  .body { padding: 22px 22px 26px; }
  .brand { text-align: center; margin-bottom: 14px; }
  .logo { width: 88px; height: auto; display: block; margin: 0 auto 8px; }
  .company { font-size: 16px; font-weight: 700; }
  .sub { font-size: 11px; color: #6b7280; margin-top: 2px; }
  .dash { border-bottom: 1px dashed #d1d5db; margin: 14px 0; }
  .info, .sum { display: flex; justify-content: space-between; gap: 12px; font-family: "Courier New", monospace; font-size: 12px; margin-bottom: 8px; }
  .lbl { color: #6b7280; }
  .val { text-align: right; color: #111827; }
  .bold { font-weight: 700; }
  .total { font-size: 15px; font-weight: 700; border-top: 1px solid #111827; padding-top: 8px; margin-top: 4px; }
  .items { margin: 4px 0; }
  .section-title { font-size: 10px; font-weight: 700; letter-spacing: 1px; color: #6b7280; text-transform: uppercase; margin: 10px 0 6px; }
  .item-row { margin-bottom: 12px; }
  .item-desc { font-family: "Courier New", monospace; font-weight: 700; font-size: 13px; margin-bottom: 4px; }
  .item-details { display: flex; justify-content: space-between; font-family: "Courier New", monospace; font-size: 12px; color: #374151; }
  .mini-divider { border-bottom: 1px dashed #e5e7eb; margin: 6px 0 8px; }
  .section-total { display: flex; justify-content: space-between; font-family: "Courier New", monospace; font-size: 12px; font-weight: 700; margin-bottom: 8px; }
  .footer { text-align: center; font-size: 11px; color: #6b7280; line-height: 1.6; }
  .btns { display: flex; gap: 10px; justify-content: center; margin: 18px auto 0; max-width: 420px; }
  .btn { flex: 1; text-align: center; background: #023C69; color: #fff; text-decoration: none; border: 0; border-radius: 16px; padding: 14px 10px; font-size: 13px; font-weight: 700; cursor: pointer; }
  .btn2 { background: #fff; color: #023C69; border: 1px solid #023C69; }
  @media print { .btns { display: none; } body { background: #fff; padding: 0; } .card { border: 0; box-shadow: none; } }
"""

def generate_html_receipt(data: Dict[str, Any], receipt_type: str = "", transaction_id: str = "") -> str:
    """Generate a thermal-style HTML receipt with OG tags"""
    
    # Base URL for OG Image
    base_url = "https://tpm.cianjur.space"
    image_url = f"{base_url}/api/v1/public/receipt/image/{receipt_type}/{transaction_id}"
    page_url = f"{base_url}/api/v1/public/receipt/view/{receipt_type}/{transaction_id}"
    
    # Load default logo as base64 for embedding
    logo_b64 = ""
    try:
        static_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "static")
        logo_path = os.path.join(static_dir, "logo_tpm.png")
        if os.path.exists(logo_path):
            with open(logo_path, "rb") as f:
                import base64 as b64
                logo_b64 = f"data:image/png;base64,{b64.b64encode(f.read()).decode()}"
    except:
        pass
    
    # Format description for OG
    customer = data.get('customerName', 'Umum')
    plate = data.get('vehiclePlate', '')
    desc = f"Struk transaksi #{data['transactionNumber']} untuk {customer}"
    if plate:
        desc += f" ({plate})"
    desc += f" senilai Rp {data['total']:,.0f}"

    def render_item_html(item: Dict[str, Any]) -> str:
        return f"""
        <div class="item-row">
            <div class="item-desc">{str(item['description']).upper()}</div>
            <div class="item-details">
                <span>{int(item['quantity'])} x {item['unitPrice']:,.0f}</span>
                <span>{item['subtotal']:,.0f}</span>
            </div>
        </div>
        """

    def render_item_section(title: str, items: list) -> str:
        if not items:
            return ""
        total = sum(float(item.get("subtotal", 0)) for item in items)
        return f"""
        <div class="section-title">{title}</div>
        {''.join(render_item_html(item) for item in items)}
        <div class="mini-divider"></div>
        <div class="section-total">
            <span>Total</span>
            <span>{total:,.0f}</span>
        </div>
        """

    items_html = ""
    for detail in data.get("details", []):
        items_html += f"""
        <div class="item-row" style="margin-bottom: 4px;">
            <div class="item-desc" style="color: #666;">{detail}</div>
        </div>
        """

    if data.get("services") or data.get("parts"):
        items_html += render_item_section("LAYANAN", data.get("services", []))
        items_html += render_item_section("SPARE PART", data.get("parts", []))
    else:
        for item in data.get("items", []):
            items_html += render_item_html(item)

    # Format Date
    try:
        dt = datetime.fromisoformat(data['date'])
        formatted_date = dt.strftime("%d/%m/%Y %H:%M")
    except:
        formatted_date = data['date']

    # Payment Status HTML
    remaining = data.get('remaining', 0)
    payment_status_html = ""
    if remaining > 0:
        payment_status_html = f"""
        <div class="summary-row">
            <span>SUDAH DIBAYAR</span>
            <span>{data.get('paid', 0):,.0f}</span>
        </div>
        <div class="summary-row" style="font-weight: bold;">
            <span>SISA TAGIHAN</span>
            <span>{remaining:,.0f}</span>
        </div>
        """
    else:
        payment_status_html = '<div class="summary-row" style="font-weight: bold; text-align: center; display: block;">*** LUNAS ***</div>'

    tipe_label = {"bengkel": "Bengkel", "jasa_angkut": "Jasa Angkut", "mobil": "Mobil"}.get(receipt_type, "Struk")
    paid = float(data.get("paid", 0) or 0)
    total = float(data.get("total", 0) or 0)
    remaining = float(data.get("remaining", total - paid) or 0)
    lunas = remaining <= 0
    status_text = "LUNAS" if lunas else "BELUM LUNAS"
    metode = str(data.get("paymentMethod") or "").upper()
    baris_metode = (
        f'<div class="sum"><span>METODE</span><span>{metode}</span></div>'
        if paid > 0 and metode and metode != "NONE" else ""
    )
    baris_plat = (
        f'<div class="info"><span class="lbl">No. Polisi</span><span class="val">{data["vehiclePlate"]}</span></div>'
        if data.get("vehiclePlate") else ""
    )
    discount = float(data.get("discount", 0) or 0)
    baris_diskon = (
        f'<div class="sum"><span>DISKON</span><span>-{discount:,.0f}</span></div>'
        if discount > 0 and data.get("showDiscount", True) else ""
    )
    logo_html = f'<img class="logo" src="{logo_b64}" alt="Logo">' if logo_b64 else ""

    return f"""
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Struk Digital - TIGA PUTRA MOTOR</title>
        <meta property="og:type" content="website">
        <meta property="og:url" content="{page_url}">
        <meta property="og:title" content="Struk Digital - TIGA PUTRA MOTOR">
        <meta property="og:description" content="{desc}">
        <meta property="og:image" content="{image_url}">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:image" content="{image_url}">
        <style>{CSS_STRUK}</style>
    </head>
    <body>
        <div class="card">
            <div class="header">
                <div>
                    <div class="kicker">STRUK DIGITAL</div>
                    <div class="type">{tipe_label}</div>
                </div>
                <div class="badge">{status_text}</div>
            </div>
            <div class="body">
                <div class="brand">
                    {logo_html}
                    <div class="company">{data.get("companyName", "Tiga Putra Motor")}</div>
                    <div class="sub">{data.get("companyAddress", "")}</div>
                    <div class="sub">Telp: {data.get("companyPhone", "")}</div>
                </div>
                <div class="dash"></div>
                <div class="info"><span class="lbl">Nomor Transaksi</span><span class="val bold">{data["transactionNumber"]}</span></div>
                <div class="info"><span class="lbl">Tanggal</span><span class="val">{formatted_date}</span></div>
                <div class="info"><span class="lbl">Pelanggan</span><span class="val">{customer}</span></div>
                {baris_plat}
                <div class="dash"></div>
                <div class="items">{items_html}</div>
                <div class="dash"></div>
                <div class="sum"><span>SUBTOTAL</span><span>{float(data.get("subtotal", 0) or 0):,.0f}</span></div>
                {baris_diskon}
                <div class="sum total"><span>TOTAL</span><span>{total:,.0f}</span></div>
                <div class="sum"><span>SUDAH DIBAYAR</span><span>{paid:,.0f}</span></div>
                <div class="sum bold"><span>SISA TAGIHAN</span><span>{remaining:,.0f}</span></div>
                {baris_metode}
                <div class="dash"></div>
                <div class="footer">
                    <div>Terima kasih</div>
                    <div>Layanan pelanggan: {data.get("companyPhone", "")}</div>
                </div>
            </div>
        </div>
        <div class="btns">
            <a class="btn" href="/api/v1/public/receipt/{receipt_type}/{transaction_id}/pdf">SIMPAN PDF</a>
            <button class="btn btn2" onclick="window.print()">CETAK</button>
        </div>
    </body>
    </html>
    """



def _draw_wrapped_centered(p, text: str, x: float, y: float, max_width: float, font_name: str, font_size: int) -> float:
    """Draw centered text, wrapping by approximate width. Returns next y."""
    from reportlab.pdfbase.pdfmetrics import stringWidth

    words = str(text or "").split()
    if not words:
        return y

    lines = []
    current = words[0]
    for word in words[1:]:
        candidate = f"{current} {word}"
        if stringWidth(candidate, font_name, font_size) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    lines.append(current)

    for line in lines:
        p.setFont(font_name, font_size)
        p.drawCentredString(x, y, line)
        y -= font_size + 3
    return y


@router.get("/{receipt_type}/{transaction_id}/pdf")
async def get_receipt_pdf(
    receipt_type: str, 
    transaction_id: str,
    db: Session = Depends(get_db)
):
    """
    Download receipt as PDF using reportlab
    Filename: nomor_transaksi-nama_pelanggan-nomor_polisi-tanggal
    """
    try:
        if receipt_type == "bengkel":
            data = get_bengkel_receipt(db, transaction_id)
        elif receipt_type == "jasa_angkut":
            data = get_jasa_angkut_receipt(db, transaction_id)
        elif receipt_type == "mobil":
            data = get_mobil_receipt(db, transaction_id)
        else:
            raise HTTPException(status_code=400, detail="Invalid receipt type")
            
        # Generate PDF
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import A5
        
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=A5)
        width, height = A5
        
        # Logo
        static_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "static")
        logo_path = os.path.join(static_dir, "logo_tpm.png")
        y_cursor = height - 40
        
        logo_img_pdf = None
        custom_logo = data.get("customLogo")
        if custom_logo and custom_logo != "tpm_default":
            try:
                if isinstance(custom_logo, str) and "," in custom_logo:
                    _header, encoded = custom_logo.split(",", 1)
                    logo_img_pdf = io.BytesIO(base64.b64decode(encoded))
            except Exception as logo_err:
                print(f"Custom logo decode failed: {logo_err}")
                logo_img_pdf = None
        
        if logo_img_pdf is None and os.path.exists(logo_path):
            logo_img_pdf = logo_path

        if logo_img_pdf is not None:
            try:
                p.drawImage(
                    logo_img_pdf,
                    width / 2 - 40,
                    y_cursor - 40,
                    width=80,
                    height=40,
                    mask='auto',
                    preserveAspectRatio=True,
                )
                y_cursor -= 50
            except Exception as logo_err:
                print(f"Logo draw failed: {logo_err}")

        # Header text from settings
        if data.get("customHeader"):
            p.setFont("Helvetica", 8)
            p.drawCentredString(width / 2, y_cursor + 8, str(data["customHeader"])[:80])
            y_cursor -= 12

        # Header
        p.setFont("Helvetica-Bold", 14)
        p.drawCentredString(width / 2, y_cursor, str(data.get("companyName") or "Tiga Putra Motor")[:60])
        y_cursor -= 16
        y_cursor = _draw_wrapped_centered(
            p,
            str(data.get("companyAddress") or "-"),
            width / 2,
            y_cursor,
            width - 80,
            "Helvetica",
            9,
        )
        p.setFont("Helvetica", 9)
        p.drawCentredString(width / 2, y_cursor, f"Telp: {data.get('companyPhone') or '-'}")
        y_cursor -= 14
        
        p.line(30, y_cursor, width - 30, y_cursor)
        y_cursor -= 18
        
        # Receipt Info
        p.setFont("Helvetica", 10)
        y = y_cursor
        p.drawString(30, y, f"No: {str(data.get('transactionNumber') or '-')[:28]}")
        
        try:
            raw_date = data.get("date") or ""
            dt = datetime.fromisoformat(str(raw_date).replace("Z", "+00:00"))
            formatted_date = dt.strftime("%d/%m/%Y %H:%M")
        except Exception:
            formatted_date = str(data.get("date") or "-")
            
        p.drawRightString(width - 30, y, formatted_date)
        y -= 16
        p.drawString(30, y, f"Pelanggan: {str(data.get('customerName') or 'Umum')[:40]}")
        
        if data.get('vehiclePlate'):
            y -= 16
            plate = str(data.get("vehiclePlate") or "")
            vtype = str(data.get("vehicleType") or "-")
            p.drawString(30, y, f"No. Polisi: {plate} / {vtype}"[:55])
            
        y -= 22
        p.line(30, y, width - 30, y)
        y -= 16
        
        # Items Table Header
        p.setFont("Helvetica-Bold", 10)
        p.drawString(30, y, "ITEM")
        p.drawRightString(width - 110, y, "QTY x HARGA")
        p.drawRightString(width - 30, y, "SUBTOTAL")
        y -= 12
        p.line(30, y, width - 30, y)
        y -= 16
        
        # Items list (services+parts combined as items)
        items = data.get("items") or []
        if not items:
            items = (data.get("services") or []) + (data.get("parts") or [])

        p.setFont("Helvetica", 9)
        for item in items:
            if y < 60:
                p.showPage()
                y = height - 50
                p.setFont("Helvetica", 9)

            desc = str(item.get("description") or "-")[:42]
            qty = int(item.get("quantity") or 1)
            unit_price = float(item.get("unitPrice") or 0)
            subtotal = float(item.get("subtotal") or 0)
            p.drawString(30, y, desc)
            p.drawRightString(width - 110, y, f"{qty} x {unit_price:,.0f}")
            p.drawRightString(width - 30, y, f"{subtotal:,.0f}")
            y -= 14

        if data.get("discount") and data.get("showDiscount", True):
            y -= 4
            p.setFont("Helvetica", 9)
            p.drawString(30, y, "Diskon")
            p.drawRightString(width - 30, y, f"-{float(data.get('discount') or 0):,.0f}")
            y -= 14
            
        y -= 6
        p.line(30, y, width - 30, y)
        y -= 20
        
        # Total
        p.setFont("Helvetica-Bold", 12)
        p.drawString(30, y, "TOTAL")
        p.drawRightString(width - 30, y, f"Rp {float(data.get('total') or 0):,.0f}")
        
        y -= 24
        remaining = float(data.get("remaining") or 0)
        status_text = "LUNAS" if remaining <= 0 else "BELUM LUNAS"
        p.drawCentredString(width / 2, y, f"*** {status_text} ***")
        
        y -= 30
        p.setFont("Helvetica-Oblique", 9)
        p.drawCentredString(width / 2, y, "TERIMA KASIH")
        if data.get("customFooter"):
            y -= 12
            p.setFont("Helvetica-Bold", 8)
            p.drawCentredString(width / 2, y, str(data["customFooter"])[:70])
            
        if data.get("showQRCode"):
            y -= 22
            p.setFont("Helvetica", 7)
            p.rect(width / 2 - 50, y - 5, 100, 15)
            p.drawCentredString(width / 2, y, "DIGITAL RECEIPT VERIFIED")
        
        p.save()
        buffer.seek(0)
        
        # Generate Filename
        def clean(s):
            return re.sub(r'[^a-zA-Z0-9]', '_', str(s or ""))
            
        try:
            raw_date = data.get("date") or ""
            dt = datetime.fromisoformat(str(raw_date).replace("Z", "+00:00"))
            date_part = dt.strftime("%d%m%Y")
        except Exception:
            date_part = datetime.now().strftime("%d%m%Y")
            
        filename = (
            f"{clean(data.get('transactionNumber'))}-"
            f"{clean(data.get('customerName'))}-"
            f"{clean(data.get('vehiclePlate') or 'NoPol')}-"
            f"{date_part}.pdf"
        )
        
        headers = {
            'Content-Disposition': f'attachment; filename="{filename}"'
        }
        
        return StreamingResponse(buffer, headers=headers, media_type="application/pdf")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Gagal membuat PDF struk: {e}")
