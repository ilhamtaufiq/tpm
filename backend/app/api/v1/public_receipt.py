"""
Public Receipt API Endpoints
Accessible without authentication for QR code scanning
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any
from datetime import datetime

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
        "subtotal": float(transaction.grand_total or 0),
        "tax": 0,
        "discount": 0,
        "total": float(transaction.grand_total or 0),
        "paymentMethod": transaction.metode_bayar,
        "notes": transaction.catatan,
        "companyName": "TPM Business",
        "companyAddress": "Jl. Contoh No. 123, Jakarta",
        "companyPhone": "(021) 1234-5678"
    }
    
    return receipt


def get_jasa_angkut_receipt(db: Session, transaction_id: str) -> Dict[str, Any]:
    """Get Jasa Angkut receipt"""
    
    # Get muatan
    muatan = db.query(MuatanJasaAngkut).filter(
        MuatanJasaAngkut.id_muatan == int(transaction_id)
    ).first()
    
    if not muatan:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Build items
    items = [{
        "description": muatan.deskripsi_muatan or "Jasa Angkut",
        "quantity": 1,
        "unitPrice": float(muatan.biaya or 0),
        "subtotal": float(muatan.biaya or 0)
    }]
    
    # Build receipt
    receipt = {
        "transactionNumber": str(muatan.id_muatan),
        "date": muatan.created_at.isoformat() if muatan.created_at else datetime.now().isoformat(),
        "customerName": muatan.nama_customer or "Umum",
        "origin": muatan.asal,
        "destination": muatan.tujuan,
        "driverName": muatan.nama_supir,
        "items": items,
        "subtotal": float(muatan.biaya or 0),
        "tax": 0,
        "discount": 0,
        "total": float(muatan.biaya or 0),
        "paymentMethod": muatan.metode_bayar,
        "notes": muatan.catatan,
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
    return {
        "message": "PDF generation coming soon",
        "downloadUrl": f"/public/receipt/{receipt_type}/{transaction_id}/pdf"
    }
