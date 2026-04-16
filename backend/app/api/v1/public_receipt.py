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
from fastapi.responses import HTMLResponse, Response, StreamingResponse
import json
import re

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
    """Generate a thermal-style OG image for the receipt"""
    # Create canvas (1200x630)
    width, height = 1200, 630
    
    # Receipt-like background (off-white)
    img = Image.new('RGB', (width, height), color='#f3f4f6')
    draw = ImageDraw.Draw(img)
    
    # Draw "Paper"
    paper_width = 500
    paper_x = (width - paper_width) // 2
    draw.rectangle([paper_x, 20, paper_x + paper_width, height - 20], fill="white", outline="#d1d5db")
    
    # Load fonts
    font_path = get_font_path(bold=False)
    font_bold_path = get_font_path(bold=True)
    
    try:
        header_font = ImageFont.truetype(font_bold_path, 32) if font_bold_path else ImageFont.load_default()
        sub_header_font = ImageFont.truetype(font_path, 18) if font_path else ImageFont.load_default()
        body_font = ImageFont.truetype(font_path, 20) if font_path else ImageFont.load_default()
        body_bold_font = ImageFont.truetype(font_bold_path, 20) if font_bold_path else ImageFont.load_default()
        total_font = ImageFont.truetype(font_bold_path, 36) if font_bold_path else ImageFont.load_default()
    except:
        header_font = ImageFont.load_default()
        sub_header_font = ImageFont.load_default()
        body_font = ImageFont.load_default()
        body_bold_font = ImageFont.load_default()
        total_font = ImageFont.load_default()
    
    # Logo
    logo_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "logo_tpm.png")
    y = 30
    if os.path.exists(logo_path):
        try:
            logo = Image.open(logo_path).convert("RGBA")
            # Resize logo to fit well in header (e.g. 100px height)
            aspect = logo.width / logo.height
            logo_w = int(80 * aspect)
            logo_h = 80
            logo = logo.resize((logo_w, logo_h), Image.Resampling.LANCZOS)
            
            # Create a white background for the logo paste if it has transparency
            img.paste(logo, (int(width/2 - logo_w/2), y), mask=logo)
            y += logo_h + 10
        except Exception as e:
            print(f"Error loading logo for OG image: {e}")
            pass

    # Business Name
    draw.text((width/2, y), data['companyName'], font=header_font, fill="black", anchor="mm")
    y += 40
    draw.text((width/2, y), data['companyAddress'], font=sub_header_font, fill="black", anchor="mm")
    y += 25
    draw.text((width/2, y), f"Telp: {data['companyPhone']}", font=sub_header_font, fill="black", anchor="mm")
    
    y += 30
    # Dashed Divider
    for x in range(paper_x + 20, paper_x + paper_width - 20, 10):
        draw.line([x, y, x + 5, y], fill="black", width=1)
    
    y += 20
    # Info
    draw.text((paper_x + 30, y), "No. Nota:", font=body_font, fill="black")
    draw.text((paper_x + paper_width - 30, y), data['transactionNumber'], font=body_bold_font, fill="black", anchor="ra")
    y += 30
    
    # Date
    try:
        dt = datetime.fromisoformat(data['date'])
        formatted_date = dt.strftime("%d/%m/%Y %H:%M")
    except:
        formatted_date = data['date']
    draw.text((paper_x + 30, y), "Tanggal:", font=body_font, fill="black")
    draw.text((paper_x + paper_width - 30, y), formatted_date, font=body_font, fill="black", anchor="ra")
    y += 30
    
    # Customer
    draw.text((paper_x + 30, y), "Pelanggan:", font=body_font, fill="black")
    draw.text((paper_x + paper_width - 30, y), data['customerName'], font=body_font, fill="black", anchor="ra")
    y += 40
    
    # Items
    for x in range(paper_x + 20, paper_x + paper_width - 20, 10):
        draw.line([x, y, x + 5, y], fill="black", width=1)
    y += 20
    
    # Only show first 3 items to avoid overflow
    items = data.get("items", [])
    for i, item in enumerate(items[:4]):
        desc = item['description'].upper()
        if len(desc) > 30: desc = desc[:27] + "..."
        draw.text((paper_x + 30, y), desc, font=body_bold_font, fill="black")
        y += 25
        qty_str = f"{int(item['quantity'])} x {item['unitPrice']:,.0f}"
        sub_str = f"{item['subtotal']:,.0f}"
        draw.text((paper_x + 40, y), qty_str, font=body_font, fill="black")
        draw.text((paper_x + paper_width - 30, y), sub_str, font=body_font, fill="black", anchor="ra")
        y += 35
    
    if len(items) > 4:
        draw.text((width/2, y), f"... and {len(items)-4} more items ...", font=sub_header_font, fill="gray", anchor="mm")
        y += 30

    y = height - 180 # Pin summary to bottom-ish
    for x in range(paper_x + 20, paper_x + paper_width - 20, 10):
        draw.line([x, y, x + 5, y], fill="black", width=1)
    y += 20
    
    # Total
    draw.text((paper_x + 30, y), "TOTAL", font=total_font, fill="black")
    total_str = f"Rp {data['total']:,.0f}"
    draw.text((paper_x + paper_width - 30, y), total_str, font=total_font, fill="black", anchor="ra")
    
    y += 60
    status_text = "LUNAS" if data.get('remaining', 0) <= 0 else "BELUM LUNAS"
    draw.text((width/2, y), f"*** {status_text} ***", font=body_bold_font, fill="black", anchor="mm")
    
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
    """Generate a thermal-style HTML receipt with OG tags"""
    
    # Base URL for OG Image
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

    items_html = ""
    for item in data.get("items", []):
        items_html += f"""
        <div class="item-row">
            <div class="item-desc">{item['description'].upper()}</div>
            <div class="item-details">
                <span>{int(item['quantity'])} x {item['unitPrice']:,.0f}</span>
                <span>{item['subtotal']:,.0f}</span>
            </div>
        </div>
        """

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

        <style>
            @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
            
            body {{ 
                font-family: 'Courier Prime', 'Courier', monospace; 
                background-color: #e5e7eb; 
                margin: 0; 
                padding: 20px 10px; 
                color: #000;
                display: flex;
                flex-direction: column;
                align-items: center;
            }}
            
            .receipt-container {{ 
                background: white; 
                width: 100%;
                max-width: 380px; 
                padding: 20px;
                box-sizing: border-box;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            }}
            .header {{ 
                text-align: center; 
                margin-bottom: 20px; 
            }}
            .logo-container {{
                display: flex;
                justify-content: center;
                margin-bottom: 10px;
            }}
            .logo-container img {{
                height: 60px;
                width: auto;
                filter: grayscale(1);
            }}
            
            .business-name {{ font-size: 18px; font-weight: 700; margin-bottom: 2px; }}
            .business-info {{ font-size: 11px; margin-bottom: 2px; }}
            
            .divider {{ border-top: 1px dashed #000; margin: 10px 0; }}
            
            .info-row {{ display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; }}
            
            .item-row {{ margin-bottom: 8px; font-size: 12px; }}
            .item-desc {{ font-weight: bold; margin-bottom: 2px; }}
            .item-details {{ display: flex; justify-content: space-between; }}
            
            .summary-row {{ display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; }}
            .grand-total {{ font-size: 16px; font-weight: 700; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 5px 0; margin: 10px 0; }}
            
            .footer {{ text-align: center; margin-top: 20px; font-size: 11px; line-height: 1.4; }}
            
            .btn-container {{ width: 100%; max-width: 380px; margin-top: 20px; }}
            .btn {{ 
                display: block; 
                width: 100%; 
                padding: 15px; 
                margin-bottom: 10px;
                background: #023C69; 
                color: white; 
                text-decoration: none; 
                border-radius: 8px; 
                font-weight: 700; 
                text-align: center; 
                border: none; 
                cursor: pointer;
                font-family: sans-serif;
                box-sizing: border-box;
            }}
            .btn-secondary {{
                background: #6b7280;
            }}
            .btn:hover {{
                opacity: 0.9;
            }}
            
            @media print {{ 
                .btn-container {{ display: none; }} 
                body {{ padding: 0; background: white; }} 
                .receipt-container {{ box-shadow: none; max-width: 100%; }} 
            }}
        </style>
    </head>
    <body>
        <div class="receipt-container">
            <div class="header">
                <div class="logo-container">
                    <img src="/static/logo_tpm.png" alt="Logo" onerror="this.style.display='none'">
                </div>
                <div class="business-name">{data['companyName']}</div>
                <div class="business-info">{data['companyAddress']}</div>
                <div class="business-info">Telp: {data['companyPhone']}</div>
            </div>
            
            <div class="divider"></div>
            
            <div class="info-row">
                <span>No. Nota:</span>
                <span>{data['transactionNumber']}</span>
            </div>
            <div class="info-row">
                <span>Tanggal:</span>
                <span>{formatted_date}</span>
            </div>
            <div class="info-row">
                <span>Pelanggan:</span>
                <span>{data['customerName']}</span>
            </div>
            {f'<div class="info-row"><span>No. Polisi:</span><span>{data["vehiclePlate"]}</span></div>' if data.get("vehiclePlate") else ''}
            
            <div class="divider"></div>
            
            <div class="items-list">
                {items_html}
            </div>
            
            <div class="divider"></div>
            
            <div class="summary">
                <div class="summary-row">
                    <span>SUBTOTAL</span>
                    <span>{data.get('subtotal', 0):,.0f}</span>
                </div>
                {f'<div class="summary-row"><span>DISKON</span><span>-{data["discount"]:,.0f}</span></div>' if data.get('discount', 0) > 0 else ''}
                
                <div class="summary-row grand-total">
                    <span>TOTAL</span>
                    <span>{data['total']:,.0f}</span>
                </div>
                
                {payment_status_html}
                
                <div class="summary-row" style="margin-top: 5px;">
                    <span>METODE</span>
                    <span>{str(data.get('paymentMethod', '-')).upper()}</span>
                </div>
            </div>
            
            <div class="divider"></div>
            
            <div class="footer">
                <div>TERIMA KASIH</div>
                <div>LAYANAN PELANGGAN: {data['companyPhone']}</div>
                <div style="margin-top: 5px;">{data.get('notes', '')}</div>
            </div>
        </div>
        
        <div class="btn-container">
            <a href="/api/v1/public/receipt/{receipt_type}/{transaction_id}/pdf" class="btn">SIMPAN SEBAGAI PDF</a>
            <button class="btn btn-secondary" onclick="window.print()">CETAK STRUK</button>
        </div>
    </body>
    </html>
    """



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
        else:
            raise HTTPException(status_code=400, detail="Invalid receipt type")
            
        # Generate PDF
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import A5
        from reportlab.lib import colors
        
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=A5)
        width, height = A5
        
        # Logo
        static_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")
        logo_path = os.path.join(static_dir, "logo_tpm.png")
        y_cursor = height - 40
        
        if os.path.exists(logo_path):
            try:
                # Place logo centered
                logo_h = 40
                p.drawImage(logo_path, width/2 - 40, y_cursor - 40, width=80, height=logo_h, mask='auto', preserveAspectRatio=True)
                y_cursor -= 50
            except:
                pass

        # Header
        p.setFont("Helvetica-Bold", 16)
        p.drawCentredString(width/2, y_cursor, data['companyName'])
        y_cursor -= 15
        p.setFont("Helvetica", 10)
        p.drawCentredString(width/2, y_cursor, data['companyAddress'])
        y_cursor -= 13
        p.drawCentredString(width/2, y_cursor, f"Telp: {data['companyPhone']}")
        y_cursor -= 12
        
        p.line(30, y_cursor, width - 30, y_cursor)
        y_cursor -= 20
        
        # Receipt Info
        p.setFont("Helvetica", 11)
        y = y_cursor
        p.drawString(30, y, f"No. Nota: {data['transactionNumber']}")
        
        try:
            dt = datetime.fromisoformat(data['date'])
            formatted_date = dt.strftime("%d/%m/%Y %H:%M")
        except:
            formatted_date = data['date']
            
        p.drawRightString(width - 30, y, f"Tanggal: {formatted_date}")
        y -= 20
        p.drawString(30, y, f"Pelanggan: {data['customerName']}")
        
        if data.get('vehiclePlate'):
            y -= 20
            p.drawString(30, y, f"No. Polisi: {data['vehiclePlate']} / {data.get('vehicleType', '-')}")
            
        y -= 30
        p.line(30, y, width - 30, y)
        y -= 20
        
        # Items Table Header
        p.setFont("Helvetica-Bold", 11)
        p.drawString(30, y, "ITEM")
        p.drawRightString(width - 120, y, "QTY x HARGA")
        p.drawRightString(width - 30, y, "SUBTOTAL")
        y -= 15
        p.line(30, y, width - 30, y)
        y -= 20
        
        # Items list
        p.setFont("Helvetica", 10)
        for item in data.get('items', []):
            if y < 50: # Page break logic simplified (A5 is small)
                p.showPage()
                y = height - 50
                p.setFont("Helvetica", 10)
            
            p.drawString(30, y, item['description'][:40])
            p.drawRightString(width - 120, y, f"{int(item['quantity'])} x {item['unitPrice']:,.0f}")
            p.drawRightString(width - 30, y, f"{item['subtotal']:,.0f}")
            y -= 15
            
        y -= 10
        p.line(30, y, width - 30, y)
        y -= 25
        
        # Total
        p.setFont("Helvetica-Bold", 12)
        p.drawString(30, y, "TOTAL")
        p.drawRightString(width - 30, y, f"Rp {data['total']:,.0f}")
        
        y -= 30
        status_text = "LUNAS" if data.get('remaining', 0) <= 0 else "BELUM LUNAS"
        p.drawCentredString(width/2, y, f"*** {status_text} ***")
        
        y -= 40
        p.setFont("Helvetica-Oblique", 9)
        p.drawCentredString(width/2, y, "Terima kasih atas kunjungan Anda")
        
        p.save()
        buffer.seek(0)
        
        # Generate Filename
        # nomor_transaksi-nama_pelanggan-nomor_polisi-tanggal
        def clean(s):
            return re.sub(r'[^a-zA-Z0-9]', '_', str(s))
            
        try:
            dt = datetime.fromisoformat(data['date'])
            date_part = dt.strftime("%d%m%Y")
        except:
            date_part = datetime.now().strftime("%d%m%Y")
            
        filename = f"{clean(data['transactionNumber'])}-{clean(data['customerName'])}-{clean(data.get('vehiclePlate', 'NoPol'))}-{date_part}.pdf"
        
        headers = {
            'Content-Disposition': f'attachment; filename="{filename}"'
        }
        
        return StreamingResponse(buffer, headers=headers, media_type="application/pdf")
        
    except Exception as e:
        print(f"Error generating PDF: {e}")
        raise HTTPException(status_code=500, detail=str(e))
