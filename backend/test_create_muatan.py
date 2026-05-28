from app.database.connection import SessionLocal
from app.services.muatan_service import MuatanService
from app.schemas.jasa_angkut import MuatanCreate
from app.utils.constants import PaymentStatus, PaymentMethod
from datetime import date
from decimal import Decimal

db = SessionLocal()
service = MuatanService(db)

try:
    data = MuatanCreate(
        tanggal=date.today(),
        supir_id=None,
        supir_nama="Test Driver",
        nopol="B 1234 TEST",
        asal="Asal",
        tujuan="Tujuan",
        jenis_muatan="Pasir",
        ritase=1,
        harga_beli=Decimal("1000000"),
        harga_jual=Decimal("2000000"),
        status_bayar=PaymentStatus.BELUM_LUNAS,
        metode_bayar=PaymentMethod.TUNAI,
        biaya_operasional=[]
    )
    
    print(f"Creating Muatan with status: {data.status_bayar}")
    muatan = service.create(data, user_id=1)
    print(f"Success! Muatan created with ID: {muatan.id}")
except Exception as e:
    print(f"FAILED: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()
