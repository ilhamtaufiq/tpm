"""
Public Receipt API Endpoints
Accessible without authentication for QR code scanning
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from datetime import datetime
import io
import os
from PIL import Image, ImageDraw, ImageFont, ImageOps
from fastapi.responses import HTMLResponse, Response
import json

from app.database.connection import get_db
from app.models.bengkel import TransaksiPenjualanBengkel
from app.models.jasa_angkut import MuatanJasaAngkut

router = APIRouter(prefix="/public/receipt", tags=["Public Receipt"])


@router.get("/{receipt_type}/{transaction_id}")
async def get_receipt(
    receipt_type: str, 
    transaction_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get receipt data by transaction ID
    Supports: bengkel, jasa_angkut
    
    Example: GET /public/receipt/bengkel/123
    """
    
    if receipt_type not in ["bengkel", "jasa_angkut"]:
        raise HTTPException(status_code=400, detail="Invalid receipt type")
    
    try:
        if receipt_type == "bengkel":
            return get_bengkel_receipt(db, transaction_id)
        else:
            return get_jasa_angkut_receipt(db, transaction_id)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching receipt: {e}")
        raise HTTPException(status_code=404, detail="Receipt not found")


def get_bengkel_receipt(db: Session, transaction_id: str) -> Dict[str, Any]:
    """Get Bengkel receipt"""
    
    # Get transaction with related data
    transaction = db.query(TransaksiPenjualanBengkel).filter(
        TransaksiPenjualanBengkel.id == int(transaction_id)
    ).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Build items list from services and parts
    items = []
    
    # Add services
    if hasattr(transaction, 'detail_services'):
        for service in transaction.detail_services:
            items.append({
                "description": service.nama_jasa,
                "quantity": 1,
                "unitPrice": float(service.harga),
                "subtotal": float(service.harga)
            })
    
    # Add parts
    if hasattr(transaction, 'detail_parts'):
        for part in transaction.detail_parts:
            items.append({
                "description": part.spare_part_nama or "Sparepart",
                "quantity": part.qty,
                "unitPrice": float(part.subtotal) / part.qty if part.qty > 0 else 0,
                "subtotal": float(part.subtotal)
            })
    
    # Build receipt
    receipt = {
        "transactionNumber": str(transaction.id),
        "date": transaction.created_at.isoformat() if transaction.created_at else datetime.now().isoformat(),
        "customerName": transaction.nama_customer or "Umum",
        "vehiclePlate": transaction.nomor_plat,
        "vehicleType": transaction.jenis_kendaraan,
        "items": items,
        "subtotal": float(transaction.subtotal or 0),
        "tax": 0,
        "discount": float(transaction.diskon or 0),
        "total": float(transaction.grand_total or 0),
        "paid": float(transaction.jumlah_bayar or 0),
        "remaining": float(transaction.grand_total or 0) - float(transaction.jumlah_bayar or 0),
        "paymentMethod": transaction.metode_bayar,
        "notes": transaction.catatan,
        "companyName": "TIGA PUTRA MOTOR",
        "companyAddress": "Jl. Raya Cianjur Sukabumi KM 5, Cianjur",
        "companyPhone": "087720225244"
    }
    
    return receipt


def get_jasa_angkut_receipt(db: Session, transaction_id: str) -> Dict[str, Any]:
    """Get Jasa Angkut receipt"""
    
    # Get muatan
    muatan = db.query(MuatanJasaAngkut).filter(
        MuatanJasaAngkut.id == int(transaction_id)
    ).first()
    
    if not muatan:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Build items
    items = [{
        "description": f"Ritase ke-{muatan.ritase}: {muatan.asal} - {muatan.tujuan}",
        "quantity": 1,
        "unitPrice": float(muatan.harga_jual or 0),
        "subtotal": float(muatan.harga_jual or 0)
    }]
    
    # Build receipt
    receipt = {
        "transactionNumber": str(muatan.nomor_transaksi),
        "date": muatan.created_at.isoformat() if muatan.created_at else datetime.now().isoformat(),
        "customerName": muatan.supir_nama or "Umum",
        "origin": muatan.asal,
        "destination": muatan.tujuan,
        "driverName": muatan.supir_nama,
        "items": items,
        "subtotal": float(muatan.harga_jual or 0),
        "tax": 0,
        "discount": 0,
        "total": float(muatan.harga_jual or 0),
        "paid": float(muatan.harga_jual or 0) if muatan.status_bayar == 'LUNAS' else 0,
        "paymentMethod": "TUNAI",
        "notes": muatan.catatan,
        "companyName": "TIGA PUTRA MOTOR",
        "companyAddress": "Jl. Raya Cianjur Sukabumi KM 5, Cianjur",
        "companyPhone": "087720225244"
    }
    
    return receipt



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

def generate_receipt_image(data: Dict[str, Any]) -> io.BytesIO:
    """Generate a beautiful 1200x630 OG image for the receipt"""
    # Create canvas (1200x630 is optimal for Facebook/WhatsApp/Twitter)
    width, height = 1200, 630
    # Create a nice gradient background (Blue to Navy)
    img = Image.new('RGB', (width, height), color='#023C69')
    draw = ImageDraw.Draw(img)
    
    # Branded Header
    draw.rectangle([0, 0, width, 120], fill='#023C69')
    draw.rectangle([0, 120, width, 128], fill='#EE2737') # Red separator
    
    # Load fonts
    font_path = get_font_path(bold=False)
    font_bold_path = get_font_path(bold=True)
    
    try:
        title_font = ImageFont.truetype(font_bold_path, 60) if font_bold_path else ImageFont.load_default()
        subtitle_font = ImageFont.truetype(font_path, 30) if font_path else ImageFont.load_default()
        label_font = ImageFont.truetype(font_bold_path, 24) if font_bold_path else ImageFont.load_default()
        value_font = ImageFont.truetype(font_path, 36) if font_path else ImageFont.load_default()
        amount_font = ImageFont.truetype(font_bold_path, 80) if font_bold_path else ImageFont.load_default()
    except:
        title_font = ImageFont.load_default()
        subtitle_font = ImageFont.load_default()
        label_font = ImageFont.load_default()
        value_font = ImageFont.load_default()
        amount_font = ImageFont.load_default()
    
    # Draw Logo/Company Name
    draw.text((60, 30), "TIGA PUTRA MOTOR", font=title_font, fill="white")
    draw.text((60, 90), "Bengkel, Variasi & Jual Beli Mobil", font=subtitle_font, fill="#e5e7eb")
    
    # White Card in the middle
    card_margin = 60
    draw.rectangle([card_margin, 160, width-card_margin, height-60], fill="white", outline="#e5e7eb")
    
    # Draw Details
    # Left Column
    draw.text((100, 200), "NO. STRUK", font=label_font, fill="#9ca3af")
    draw.text((100, 230), f"#{data['transactionNumber']}", font=value_font, fill="#111827")
    
    draw.text((100, 310), "NAMA PELANGGAN", font=label_font, fill="#9ca3af")
    draw.text((100, 340), data['customerName'], font=value_font, fill="#111827")
    
    # Right Column
    draw.text((600, 200), "IDENTITAS KENDARAAN", font=label_font, fill="#9ca3af")
    plate = data.get('vehiclePlate', '-')
    vtype = data.get('vehicleType', '-')
    draw.text((600, 230), f"{plate} / {vtype}", font=value_font, fill="#111827")
    
    draw.text((600, 310), "TANGGAL", font=label_font, fill="#9ca3af")
    try:
        dt = datetime.fromisoformat(data['date'])
        formatted_date = dt.strftime("%d %b %Y, %H:%M")
    except:
        formatted_date = data['date']
    draw.text((600, 340), formatted_date, font=value_font, fill="#111827")
    
    # Bottom Horizontal Line
    draw.line([100, 420, width-100, 420], fill="#f3f4f6", width=2)
    
    # Total Amount
    draw.text((100, 460), "TOTAL PEMBAYARAN", font=label_font, fill="#023C69")
    total_str = f"Rp {data['total']:,.0f}"
    draw.text((100, 490), total_str, font=amount_font, fill="#023C69")
    
    # Status Badge
    status_text = "LUNAS" if data.get('remaining', 0) <= 0 else "BELUM LUNAS"
    status_color = "#10B981" if status_text == "LUNAS" else "#EF4444"
    
    # Measure text for badge
    # In newer Pillow version, use draw.textbbox
    try:
        text_bbox = draw.textbbox((0, 0), status_text, font=label_font)
        text_w = text_bbox[2] - text_bbox[0]
        text_h = text_bbox[3] - text_bbox[1]
    except:
        text_w, text_h = 100, 30 # fallback
        
    badge_x = width - card_margin - text_w - 60
    draw.rectangle([badge_x - 20, 490, badge_x + text_w + 20, 490 + text_h + 30], fill=status_color)
    draw.text((badge_x, 490 + 10), status_text, font=label_font, fill="white")
    
    # Save to bytes
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return buf

@router.get("/image/{receipt_type}/{transaction_id}")
async def get_receipt_image(
    receipt_type: str, 
    transaction_id: str,
    db: Session = Depends(get_db)
):
    """
    Generate dynamic OG image for the receipt
    """
    try:
        if receipt_type == "bengkel":
            data = get_bengkel_receipt(db, transaction_id)
        elif receipt_type == "jasa_angkut":
            data = get_jasa_angkut_receipt(db, transaction_id)
        else:
            raise HTTPException(status_code=400, detail="Invalid receipt type")
            
        img_buf = generate_receipt_image(data)
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
        else:
            raise HTTPException(status_code=400, detail="Invalid receipt type")
            
        return generate_html_receipt(data, receipt_type, transaction_id)
    except Exception as e:
        print(f"Error generating public view: {e}")
        return HTMLResponse(content="<div style='text-align:center; padding: 50px;'><h1 style='color:#EE2737;'>Struk tidak ditemukan</h1><p>Pastikan link yang Anda buka sudah benar.</p></div>", status_code=404)

def generate_html_receipt(data: Dict[str, Any], receipt_type: str = "", transaction_id: str = "") -> str:
    """Generate a premium HTML receipt with OG tags"""
    
    # Base URL for OG Image
    # Ideally this would come from settings or request
    base_url = "https://tpm.cianjur.space"
    image_url = f"{base_url}/api/v1/public/receipt/image/{receipt_type}/{transaction_id}"
    page_url = f"{base_url}/api/v1/public/receipt/view/{receipt_type}/{transaction_id}"
    
    # Format description for OG
    customer = data.get('customerName', 'Umum')
    plate = data.get('vehiclePlate', '')
    desc = f"Struk transaksi #{data['transactionNumber']} untuk {customer}"
    if plate:
        desc += f" ({plate})"
    desc += f" senilai Rp {data['total']:,.0f}"
    for item in data.get("items", []):
        items_html += f"""
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px dashed #e5e7eb; padding-bottom: 8px;">
            <div style="flex: 1; padding-right: 12px;">
                <div style="font-weight: 600; color: #1f2937; margin-bottom: 2px;">{item['description']}</div>
                <div style="font-size: 13px; color: #6b7280;">{int(item['quantity'])} x Rp {item['unitPrice']:,.0f}</div>
            </div>
            <div style="font-weight: 700; color: #111827; white-space: nowrap;">Rp {item['subtotal']:,.0f}</div>
        </div>
        """

    # Format Date
    try:
        dt = datetime.fromisoformat(data['date'])
        formatted_date = dt.strftime("%d %b %Y, %H:%M")
    except:
        formatted_date = data['date']

    # Payment Status HTML
    remaining = data.get('remaining', 0)
    payment_status_html = ""
    if remaining > 0:
        payment_status_html = f"""
        <div style="display: flex; justify-content: space-between; color: #10B981; font-size: 14px; margin-bottom: 4px;">
            <span>Sudah Dibayar</span>
            <span>Rp {data.get('paid', 0):,.0f}</span>
        </div>
        <div style="display: flex; justify-content: space-between; color: #EF4444; font-size: 14px; font-weight: 700;">
            <span>Sisa Tagihan</span>
            <span>Rp {remaining:,.0f}</span>
        </div>
        """

    return f"""
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Struk Digital - {data['transactionNumber']}</title>
        
        <!-- Open Graph / Social Media -->
        <meta property="og:type" content="website">
        <meta property="og:url" content="{page_url}">
        <meta property="og:title" content="Struk Digital - TIGA PUTRA MOTOR">
        <meta property="og:description" content="{desc}">
        <meta property="og:image" content="{image_url}">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">

        <!-- Twitter -->
        <meta property="twitter:card" content="summary_large_image">
        <meta property="twitter:url" content="{page_url}">
        <meta property="twitter:title" content="Struk Digital - TIGA PUTRA MOTOR">
        <meta property="twitter:description" content="{desc}">
        <meta property="twitter:image" content="{image_url}">

        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
            body {{ font-family: 'Outfit', sans-serif; background-color: #f3f4f6; margin: 0; padding: 16px; color: #374151; }}
            .receipt-card {{ background: white; max-width: 500px; margin: 0 auto; border-radius: 32px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05); overflow: hidden; border: 1px solid #e5e7eb; }}
            .header {{ background-color: #023C69; color: white; padding: 40px 24px; text-align: center; border-bottom: 6px solid #EE2737; }}
            .content {{ padding: 32px 20px; }}
            .business-name {{ font-size: 26px; font-weight: 700; margin-bottom: 6px; letter-spacing: -1px; }}
            .business-info {{ font-size: 13px; opacity: 0.8; margin-bottom: 2px; }}
            .section-title {{ font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px; margin-top: 32px; border-left: 3px solid #EE2737; padding-left: 10px; }}
            .info-grid {{ display: flex; flex-wrap: wrap; margin-bottom: 24px; gap: 20px; }}
            .info-item {{ flex: 1; min-width: 140px; }}
            .info-item label {{ display: block; font-size: 10px; color: #9ca3af; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; }}
            .info-item span {{ font-size: 14px; font-weight: 600; color: #111827; }}
            .total-box {{ background-color: #f9fafb; border-radius: 20px; padding: 24px; margin-top: 32px; border: 1px solid #f3f4f6; }}
            .total-row {{ display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 14px; color: #6b7280; }}
            .grand-total {{ font-size: 24px; font-weight: 700; color: #023C69; margin-top: 16px; padding-top: 16px; border-top: 2px solid #e5e7eb; }}
            .footer {{ text-align: center; padding: 32px 24px; font-size: 13px; color: #9ca3af; line-height: 1.6; background-color: #f9fafb; }}
            .btn {{ display: block; width: 100%; padding: 18px; background: #023C69; color: white; text-decoration: none; border-radius: 16px; font-weight: 700; text-align: center; margin-top: 24px; border: none; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(2, 60, 105, 0.2); }}
            .btn:active {{ transform: scale(0.98); }}
            @media print {{ .btn {{ display: none; }} body {{ padding: 0; background: white; }} .receipt-card {{ box-shadow: none; border: none; max-width: 100%; border-radius: 0; }} }}
        </style>
    </head>
    <body>
        <div class="receipt-card">
            <div class="header">
                <div class="business-name">TIGA PUTRA MOTOR</div>
                <div class="business-info">Bengkel, Variasi & Jual Beli Mobil</div>
                <div class="business-info">Jl. Raya Cianjur Sukabumi KM 5, Cianjur</div>
                <div class="business-info">WhatsApp: 0877-2022-5244</div>
            </div>
            
            <div class="content">
                <div class="info-grid">
                    <div class="info-item">
                        <label>No. Struk</label>
                        <span>#{data['transactionNumber']}</span>
                    </div>
                    <div class="info-item">
                        <label>Waktu Transaksi</label>
                        <span>{formatted_date}</span>
                    </div>
                </div>

                <div class="info-grid">
                    <div class="info-item">
                        <label>Nama Pelanggan</label>
                        <span>{data['customerName']}</span>
                    </div>
                    <div class="info-item">
                        <label>Identitas Kendaraan</label>
                        <span>{data.get('vehiclePlate', '-')} / {data.get('vehicleType', '-')}</span>
                    </div>
                </div>

                <div class="section-title">Item Transaksi</div>
                <div class="items-list">
                    {items_html}
                </div>

                <div class="total-box">
                    <div class="total-row">
                        <span>Subtotal</span>
                        <span>Rp {data.get('subtotal', 0):,.0f}</span>
                    </div>
                    {f'<div class="total-row" style="color:#EE2737;"><span>Diskon</span><span>- Rp {data["discount"]:,.0f}</span></div>' if data.get('discount', 0) > 0 else ''}
                    
                    <div class="grand-total">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span>Total</span>
                            <span>Rp {data['total']:,.0f}</span>
                        </div>
                    </div>
                    
                    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                        {payment_status_html if payment_status_html else f'<div style="display: flex; justify-content: space-between; color: #10B981; font-weight: 700;"><span>Status</span><span>LUNAS</span></div>'}
                    </div>
                </div>

                <button class="btn" onclick="window.print()">Simpan / Cetak Struk</button>
            </div>
            
            <div class="footer">
                <strong>Terima kasih atas kunjungan Anda!</strong><br>
                Kepuasan pelanggan adalah prioritas kami.<br>
                <span>Hanya berlaku sebagai bukti pembayaran sah.</span>
            </div>
        </div>
    </body>
    </html>
    """


@router.get("/{receipt_type}/{transaction_id}/pdf")
async def get_receipt_pdf(receipt_type: str, transaction_id: str):
    """
    Download receipt as PDF
    
    Example: GET /public/receipt/bengkel/123/pdf
    """
    # TODO: Implement PDF generation
    return {
        "message": "PDF generation coming soon",
        "downloadUrl": f"/public/receipt/{receipt_type}/{transaction_id}/pdf"
    }
