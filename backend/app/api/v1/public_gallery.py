"""
Public Gallery API Endpoints
Accessible without authentication - allows customers to view car media (photos/videos)
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session, joinedload
from typing import Dict, Any

from app.database.connection import get_db
from app.models.mobil import Mobil, MobilMedia

router = APIRouter(prefix="/public/gallery", tags=["Public Gallery"])


@router.get("/mobil/{gallery_token}")
async def get_mobil_gallery_data(
    gallery_token: str,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Get car media gallery data (JSON).
    Public endpoint - no auth required.
    """
    mobil = (
        db.query(Mobil)
        .options(joinedload(Mobil.media))
        .filter(Mobil.public_gallery_token == gallery_token, Mobil.is_deleted == False)
        .first()
    )

    if not mobil:
        raise HTTPException(status_code=404, detail="Mobil tidak ditemukan")

    media_list = []
    for m in (mobil.media or []):
        file_path = m.file_path.lstrip("/")
        media_list.append({
            "id": m.id,
            "file_path": file_path,
            "file_type": m.file_type,
            "file_name": m.file_name,
            "is_primary": m.is_primary,
        })

    return {
        "public_gallery_token": gallery_token,
        "merek": mobil.merek,
        "model": mobil.model,
        "tahun": mobil.tahun,
        "warna": mobil.warna,
        "nomor_plat": mobil.nomor_plat,
        "transmisi": mobil.transmisi,
        "kilometer": mobil.kilometer,
        "status": mobil.status.value if mobil.status else None,
        "media": media_list,
        "media_count": len(media_list),
    }


@router.get("/mobil/{gallery_token}/view", response_class=HTMLResponse)
async def view_mobil_gallery(
    gallery_token: str,
    db: Session = Depends(get_db),
):
    """
    Public HTML gallery page for a car's media.
    Shareable via WhatsApp, social media, etc.
    """
    mobil = (
        db.query(Mobil)
        .options(joinedload(Mobil.media))
        .filter(Mobil.public_gallery_token == gallery_token, Mobil.is_deleted == False)
        .first()
    )

    if not mobil:
        return HTMLResponse(
            content="""
            <div style="text-align:center; padding: 60px 20px; font-family: 'Outfit', sans-serif;">
                <h1 style="color:#EE2737; font-size: 28px;">Unit Tidak Ditemukan</h1>
                <p style="color:#6b7280;">Pastikan link yang Anda buka sudah benar.</p>
            </div>
            """,
            status_code=404,
        )

    media_list = mobil.media or []
    title = f"{mobil.merek} {mobil.model} {mobil.tahun}"
    subtitle = f"{mobil.nomor_plat} • {mobil.warna} • {mobil.transmisi or 'N/A'}"

    base_url = "https://tpm.cianjur.space"
    page_url = f"{base_url}/api/v1/public/gallery/mobil/{gallery_token}/view"

    # OG image: use the first image or a placeholder
    og_image = ""
    if media_list:
        first_img = next((m for m in media_list if m.file_type == "image"), None)
        if first_img:
            file_path = first_img.file_path.lstrip("/")
            og_image = f"{base_url}/uploads/{file_path}"

    # Build media HTML items
    media_html = ""
    for idx, m in enumerate(media_list):
        file_path = m.file_path.lstrip("/")
        full_url = f"/uploads/{file_path}"

        if m.file_type == "video":
            media_html += f"""
            <div class="media-item" data-index="{idx}">
                <video controls preload="metadata" playsinline
                    poster="" style="width:100%; border-radius:16px; background:#000;">
                    <source src="{full_url}" type="video/mp4">
                    Browser Anda tidak mendukung video.
                </video>
                <div class="media-badge">🎬 Video</div>
            </div>
            """
        else:
            media_html += f"""
            <div class="media-item" data-index="{idx}" onclick="openViewer('{full_url}')">
                <img src="{full_url}" alt="{title}" loading="lazy"
                    style="width:100%; border-radius:16px; cursor:pointer; object-fit:cover; aspect-ratio:4/3;" />
                <div class="media-badge">📷 Foto</div>
            </div>
            """

    if not media_list:
        media_html = """
        <div style="text-align:center; padding: 80px 20px; background:#f9fafb; border-radius:24px; border:2px dashed #e5e7eb;">
            <div style="font-size:64px; margin-bottom:16px; opacity:0.3;">🖼️</div>
            <p style="color:#9ca3af; font-weight:600;">Belum ada media untuk unit ini</p>
        </div>
        """

    # Specs HTML
    specs_html = ""
    specs = [
        ("📅", "Tahun", str(mobil.tahun)),
        ("🎨", "Warna", mobil.warna),
        ("⚙️", "Transmisi", mobil.transmisi or "-"),
        ("🔢", "Kilometer", f"{mobil.kilometer:,} KM" if mobil.kilometer else "-"),
    ]
    for icon, label, value in specs:
        specs_html += f"""
        <div class="spec-card">
            <div class="spec-icon">{icon}</div>
            <div class="spec-label">{label}</div>
            <div class="spec-value">{value}</div>
        </div>
        """

    og_desc = f"{title} | {subtitle} | {len(media_list)} foto/video tersedia"

    return f"""
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{title} - TIGA PUTRA MOTOR</title>

        <!-- Open Graph / Social Media -->
        <meta property="og:type" content="website">
        <meta property="og:url" content="{page_url}">
        <meta property="og:title" content="{title} - TIGA PUTRA MOTOR">
        <meta property="og:description" content="{og_desc}">
        {"<meta property='og:image' content='" + og_image + "'>" if og_image else ""}
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">

        <!-- Twitter -->
        <meta property="twitter:card" content="summary_large_image">
        <meta property="twitter:title" content="{title} - TIGA PUTRA MOTOR">
        <meta property="twitter:description" content="{og_desc}">
        {"<meta property='twitter:image' content='" + og_image + "'>" if og_image else ""}

        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{
                font-family: 'Outfit', sans-serif;
                background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);
                min-height: 100vh;
                color: #1e293b;
            }}

            .page-container {{
                max-width: 520px;
                margin: 0 auto;
                padding: 0;
            }}

            /* Header */
            .hero {{
                background: linear-gradient(135deg, #023C69 0%, #034e8a 50%, #0369a1 100%);
                padding: 40px 24px 32px;
                text-align: center;
                position: relative;
                overflow: hidden;
            }}
            .hero::after {{
                content: '';
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 6px;
                background: linear-gradient(90deg, #EE2737, #FF6B35, #EE2737);
            }}
            .hero-badge {{
                display: inline-block;
                background: rgba(255,255,255,0.15);
                backdrop-filter: blur(10px);
                padding: 6px 16px;
                border-radius: 100px;
                font-size: 11px;
                font-weight: 700;
                color: rgba(255,255,255,0.9);
                letter-spacing: 2px;
                text-transform: uppercase;
                margin-bottom: 16px;
                border: 1px solid rgba(255,255,255,0.1);
            }}
            .hero h1 {{
                color: white;
                font-size: 28px;
                font-weight: 800;
                margin-bottom: 8px;
                letter-spacing: -0.5px;
            }}
            .hero p {{
                color: rgba(255,255,255,0.7);
                font-size: 14px;
                font-weight: 500;
            }}

            /* Content */
            .content {{
                padding: 0 16px 40px;
                margin-top: -12px;
                position: relative;
            }}

            /* Specs */
            .specs-grid {{
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin-bottom: 28px;
                background: white;
                padding: 16px;
                border-radius: 24px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.06);
                border: 1px solid #f1f5f9;
            }}
            .spec-card {{
                text-align: center;
                padding: 12px 8px;
                background: #f8fafc;
                border-radius: 16px;
            }}
            .spec-icon {{ font-size: 22px; margin-bottom: 4px; }}
            .spec-label {{
                font-size: 10px;
                font-weight: 700;
                color: #94a3b8;
                text-transform: uppercase;
                letter-spacing: 1.5px;
                margin-bottom: 2px;
            }}
            .spec-value {{
                font-size: 15px;
                font-weight: 700;
                color: #1e293b;
            }}

            /* Section */
            .section-header {{
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 16px;
            }}
            .section-title {{
                font-size: 18px;
                font-weight: 800;
                color: #1e293b;
                letter-spacing: -0.3px;
            }}
            .media-count {{
                background: #023C69;
                color: white;
                padding: 4px 14px;
                border-radius: 100px;
                font-size: 12px;
                font-weight: 700;
            }}

            /* Media Grid */
            .media-grid {{
                display: flex;
                flex-direction: column;
                gap: 12px;
            }}
            .media-item {{
                position: relative;
                border-radius: 20px;
                overflow: hidden;
                background: #f1f5f9;
                box-shadow: 0 2px 12px rgba(0,0,0,0.06);
                transition: transform 0.2s;
            }}
            .media-item:active {{
                transform: scale(0.98);
            }}
            .media-badge {{
                position: absolute;
                top: 12px;
                left: 12px;
                background: rgba(0,0,0,0.5);
                backdrop-filter: blur(10px);
                color: white;
                font-size: 11px;
                font-weight: 700;
                padding: 4px 12px;
                border-radius: 100px;
                border: 1px solid rgba(255,255,255,0.1);
            }}

            /* Full Viewer */
            .viewer-overlay {{
                display: none;
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.95);
                z-index: 1000;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }}
            .viewer-overlay.active {{ display: flex; }}
            .viewer-overlay img {{
                max-width: 100%;
                max-height: 85vh;
                border-radius: 12px;
                object-fit: contain;
            }}
            .viewer-close {{
                position: absolute;
                top: 20px;
                right: 20px;
                width: 44px;
                height: 44px;
                background: rgba(255,255,255,0.15);
                border: 1px solid rgba(255,255,255,0.2);
                border-radius: 50%;
                color: white;
                font-size: 22px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            }}

            /* Footer */
            .footer {{
                text-align: center;
                padding: 32px 24px;
                background: white;
                border-top: 1px solid #f1f5f9;
                margin-top: 12px;
                border-radius: 24px 24px 0 0;
            }}
            .footer-brand {{
                font-size: 16px;
                font-weight: 800;
                color: #023C69;
                margin-bottom: 4px;
            }}
            .footer-info {{
                font-size: 12px;
                color: #94a3b8;
                line-height: 1.6;
            }}

            .wa-btn {{
                display: inline-flex;
                align-items: center;
                gap: 8px;
                background: #25D366;
                color: white;
                text-decoration: none;
                padding: 14px 28px;
                border-radius: 16px;
                font-weight: 700;
                font-size: 15px;
                margin-top: 20px;
                box-shadow: 0 4px 12px rgba(37,211,102,0.3);
                transition: transform 0.2s;
            }}
            .wa-btn:active {{ transform: scale(0.97); }}
        </style>
    </head>
    <body>
        <div class="page-container">
            <div class="hero">
                <div class="hero-badge">Tiga Putra Motor</div>
                <h1>{title}</h1>
                <p>{subtitle}</p>
            </div>

            <div class="content">
                <div class="specs-grid">
                    {specs_html}
                </div>

                <div class="section-header">
                    <div class="section-title">Galeri Media</div>
                    <div class="media-count">{len(media_list)} item</div>
                </div>

                <div class="media-grid">
                    {media_html}
                </div>
            </div>

            <div class="footer">
                <div class="footer-brand">TIGA PUTRA MOTOR</div>
                <div class="footer-info">
                    Bengkel, Variasi & Jual Beli Mobil<br>
                    Jl. Raya Cianjur Sukabumi KM 5, Cianjur
                </div>
                <a href="https://wa.me/6287720225244?text=Halo,%20saya%20tertarik%20dengan%20mobil%20{title.replace(' ', '%20')}" class="wa-btn" target="_blank">
                    💬 Hubungi via WhatsApp
                </a>
            </div>
        </div>

        <!-- Full-screen Image Viewer -->
        <div class="viewer-overlay" id="viewer" onclick="closeViewer()">
            <button class="viewer-close" onclick="closeViewer()">✕</button>
            <img id="viewer-img" src="" alt="Preview" />
        </div>

        <script>
            function openViewer(src) {{
                const viewer = document.getElementById('viewer');
                const img = document.getElementById('viewer-img');
                img.src = src;
                viewer.classList.add('active');
                document.body.style.overflow = 'hidden';
            }}
            function closeViewer() {{
                const viewer = document.getElementById('viewer');
                viewer.classList.remove('active');
                document.body.style.overflow = '';
            }}
            document.addEventListener('keydown', function(e) {{
                if (e.key === 'Escape') closeViewer();
            }});
        </script>
    </body>
    </html>
    """
