from fastapi import APIRouter

from app.api.v1 import (
    auth,
    suppliers,
    customers,
    spare_parts,
    pembelian_parts,
    transaksi_bengkel,
    pengeluaran,
    mobil,
    penjualan_mobil,
    supir,
    muatan,
    karyawan,
    absensi,
    slip_gaji,
    kasbon,
    piutang,
    hutang,
    kas_bank,
    dashboard,
    maintenance,
    jasa_servis,
    public_receipt,
    public_gallery,
    armada,
    assets,
    security,
    settings,
    user_cash,
    backup,
    trash,
    laporan,
    realtime,
    master_data,
)


api_router = APIRouter(prefix="/api/v1")

# Include all routers
api_router.include_router(auth.router)
api_router.include_router(suppliers.router)
api_router.include_router(customers.router)
api_router.include_router(spare_parts.router)
api_router.include_router(jasa_servis.router, prefix="/jasa-servis", tags=["Jasa Servis"])
api_router.include_router(pembelian_parts.router)
api_router.include_router(transaksi_bengkel.router)
api_router.include_router(pengeluaran.router)
api_router.include_router(mobil.router)
api_router.include_router(penjualan_mobil.router)
api_router.include_router(supir.router)
api_router.include_router(muatan.router)
api_router.include_router(karyawan.router)
api_router.include_router(absensi.router)
api_router.include_router(slip_gaji.router)
api_router.include_router(kasbon.router)
api_router.include_router(piutang.router)
api_router.include_router(hutang.router)
api_router.include_router(kas_bank.router)
api_router.include_router(dashboard.router)
api_router.include_router(laporan.router)
api_router.include_router(maintenance.router)
api_router.include_router(armada.router)
api_router.include_router(assets.router)
api_router.include_router(security.router)
api_router.include_router(settings.router)
api_router.include_router(user_cash.router)
api_router.include_router(backup.router)
api_router.include_router(trash.router, prefix="/trash", tags=["Trash"])
api_router.include_router(master_data.router)




# Public endpoints (no auth required) - mount outside /api/v1
from fastapi import FastAPI
api_router.include_router(public_receipt.router, prefix="", tags=["Public Receipt"])
api_router.include_router(public_gallery.router, prefix="", tags=["Public Gallery"])

