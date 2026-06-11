"""
Public Receipt API Endpoints
Accessible without authentication for QR code scanning
"""

from fastapi import APIRouter, HTTPException
from app.db.database import get_db_connection
from typing import Dict, Any, List
from datetime import datetime

router = APIRouter(prefix="/public/receipt", tags=["Public Receipt"])


def format_currency(amount: float) -> str:
    """Format currency to IDR"""
    return f"Rp {amount:,.0f}".replace(",", ".")


@router.get("/{receipt_type}/{transaction_id}")
async def get_receipt(receipt_type: str, transaction_id: str) -> Dict[str, Any]:
    """
    Get receipt data by transaction ID
    Supports: bengkel, jasa_angkut
    
    Example: GET /public/receipt/bengkel/123
    """
    
    if receipt_type not in ["bengkel", "jasa_angkut"]:
        raise HTTPException(status_code=400, detail="Invalid receipt type")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        if receipt_type == "bengkel":
            return await get_bengkel_receipt(cursor, transaction_id)
        else:
            return await get_jasa_angkut_receipt(cursor, transaction_id)
    
    except Exception as e:
        raise HTTPException(status_code=404, detail="Receipt not found")
    finally:
        cursor.close()
        conn.close()


async def get_bengkel_receipt(cursor, transaction_id: str) -> Dict[str, Any]:
    """Get Bengkel receipt"""
    
    # Get main transaction
    cursor.execute("""
        SELECT id, nama_customer, nomor_plat, jenis_kendaraan,
               grand_total, metode_bayar, catatan, created_at
        FROM transaksi_bengkel
        WHERE id = ?
    """, (transaction_id,))
    
    transaction = cursor.fetchone()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Get services
    cursor.execute("""
        SELECT nama_jasa, harga
        FROM detail_service_transaksi
        WHERE transaksi_bengkel_id = %s
    """, (transaction_id,))
    services = cursor.fetchall()
    
    # Get parts
    cursor.execute("""
        SELECT dpt.spare_part_nama, dpt.qty, dpt.subtotal
        FROM detail_part_transaksi dpt
        WHERE dpt.transaksi_bengkel_id = %s
    """, (transaction_id,))
    parts = cursor.fetchall()
    
    # Build items list
    items = []
    
    # Add services
    for service in services:
        items.append({
            "description": service['nama_jasa'],
            "quantity": 1,
            "unitPrice": float(service['harga']),
            "subtotal": float(service['harga'])
        })
    
    # Add parts
    for part in parts:
        items.append({
            "description": part['spare_part_nama'],
            "quantity": part['qty'],
            "unitPrice": float(part['subtotal']) / part['qty'],
            "subtotal": float(part['subtotal'])
        })
    
    # Build receipt
    receipt = {
        "transactionNumber": str(transaction['id']),
        "date": transaction['created_at'].isoformat() if transaction['created_at'] else datetime.now().isoformat(),
        "customerName": transaction['nama_customer'] or "Umum",
        "vehiclePlate": transaction['nomor_plat'],
        "vehicleType": transaction['jenis_kendaraan'],
        "items": items,
        "subtotal": float(transaction['grand_total']),
        "tax": 0,
        "discount": 0,
        "total": float(transaction['grand_total']),
        "paymentMethod": transaction['metode_bayar'],
        "notes": transaction['catatan'],
        "companyName": "TPM Business",  # From settings
        "companyAddress": "Jl. Contoh No. 123, Jakarta",
        "companyPhone": "(021) 1234-5678"
    }
    
    return receipt


async def get_jasa_angkut_receipt(cursor, transaction_id: str) -> Dict[str, Any]:
    """Get Jasa Angkut receipt"""
    
    # Get main transaction
    cursor.execute("""
        SELECT m.id_muatan, m.nama_customer, m.deskripsi_muatan,
               m.asal, m.tujuan, m.biaya, m.metode_bayar, 
               m.catatan, m.created_at, m.nama_supir
        FROM muatan m
        WHERE m.id_muatan = %s
    """, (transaction_id,))
    
    transaction = cursor.fetchone()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Build items
    items = [{
        "description": transaction['deskripsi_muatan'] or "Jasa Angkut",
        "quantity": 1,
        "unitPrice": float(transaction['biaya']),
        "subtotal": float(transaction['biaya'])
    }]
    
    # Build receipt
    receipt = {
        "transactionNumber": str(transaction['id_muatan']),
        "date": transaction['created_at'].isoformat() if transaction['created_at'] else datetime.now().isoformat(),
        "customerName": transaction['nama_customer'] or "Umum",
        "origin": transaction['asal'],
        "destination": transaction['tujuan'],
        "driverName": transaction['nama_supir'],
        "items": items,
        "subtotal": float(transaction['biaya']),
        "tax": 0,
        "discount": 0,
        "total": float(transaction['biaya']),
        "paymentMethod": transaction['metode_bayar'],
        "notes": transaction['catatan'],
        "companyName": "TPM Business",
        "companyAddress": "Jl. Contoh No. 123, Jakarta",
        "companyPhone": "(021) 1234-5678"
    }
    
    return receipt


@router.get("/{receipt_type}/{transaction_id}/pdf")
async def get_receipt_pdf(receipt_type: str, transaction_id: str):
    """
    Download receipt as PDF
    
    Example: GET /public/receipt/bengkel/123/pdf
    """
    # TODO: Implement PDF generation
    # For now, return JSON with download URL
    return {
        "message": "PDF generation coming soon",
        "downloadUrl": f"/public/receipt/{receipt_type}/{transaction_id}/pdf"
    }
