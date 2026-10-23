"""Ubah nama atau nopol customer di master data ikut mengubah riwayat transaksi bengkel dan piutangnya."""
from datetime import date
from decimal import Decimal

import pytest

from app.database import SessionLocal
from app.models.bengkel import TransaksiPenjualanBengkel
from app.models.customer import Customer, CustomerVehicle
from app.models.keuangan import PiutangUsaha
from app.schemas.master import CustomerUpdate, VehicleCreate
from app.services.customer_service import CustomerService
from app.utils.constants import PiutangSource, PiutangStatus

KODE = "UJI-SYNC-CUST"
NOMOR_TRX = "BGL-TEST-SYNC-1"
NOMOR_PTG = "PTG-TEST-SYNC-1"


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.rollback()
    customer = session.query(Customer).filter(Customer.kode == KODE).first()
    session.query(PiutangUsaha).filter(PiutangUsaha.nomor_piutang == NOMOR_PTG).delete(synchronize_session=False)
    session.query(TransaksiPenjualanBengkel).filter(TransaksiPenjualanBengkel.nomor_transaksi == NOMOR_TRX).delete(synchronize_session=False)
    if customer:
        session.query(CustomerVehicle).filter(CustomerVehicle.customer_id == customer.id).delete(synchronize_session=False)
        session.delete(customer)
    session.commit()
    session.close()


def _siapkan(db):
    customer = Customer(kode=KODE, nama="UJI SYNC LAMA", tipe="perorangan")
    db.add(customer)
    db.flush()
    db.add(CustomerVehicle(customer_id=customer.id, plat_nomor="B 1 OLD", jenis_unit="Avanza"))
    db.add(TransaksiPenjualanBengkel(
        nomor_transaksi=NOMOR_TRX, tanggal=date.today(), customer_id=customer.id,
        nama_customer="UJI SYNC LAMA", nomor_plat="B 1 OLD", grand_total=Decimal("0"),
    ))
    db.add(PiutangUsaha(
        nomor_piutang=NOMOR_PTG, tanggal=date.today(), sumber=PiutangSource.LAINNYA, customer_id=customer.id,
        nama_debitur="UJI SYNC LAMA", nominal_piutang=Decimal("100000"), total_dibayar=Decimal("0"),
        sisa_piutang=Decimal("100000"), status=PiutangStatus.BELUM_LUNAS, is_internal=False,
    ))
    db.commit()
    return customer


def test_ubah_nama_dan_nopol_ikut_ke_riwayat(db):
    customer = _siapkan(db)
    CustomerService(db).update(customer.id, CustomerUpdate(
        nama="UJI SYNC BARU",
        vehicles=[VehicleCreate(plat_nomor="B 2 NEW", jenis_unit="Avanza")],
    ))
    trx = db.query(TransaksiPenjualanBengkel).filter(TransaksiPenjualanBengkel.nomor_transaksi == NOMOR_TRX).one()
    ptg = db.query(PiutangUsaha).filter(PiutangUsaha.nomor_piutang == NOMOR_PTG).one()
    assert trx.nama_customer == "UJI SYNC BARU"
    assert trx.nomor_plat == "B 2 NEW"
    assert ptg.nama_debitur == "UJI SYNC BARU"


def test_nopol_lain_tidak_ikut_berubah(db):
    customer = _siapkan(db)
    CustomerService(db).update(customer.id, CustomerUpdate(
        nama="UJI SYNC LAMA",
        vehicles=[VehicleCreate(plat_nomor="B 9 OTHER", jenis_unit="Avanza"), VehicleCreate(plat_nomor="B 1 OLD", jenis_unit="Avanza")],
    ))
    trx = db.query(TransaksiPenjualanBengkel).filter(TransaksiPenjualanBengkel.nomor_transaksi == NOMOR_TRX).one()
    assert trx.nomor_plat == "B 1 OLD"
