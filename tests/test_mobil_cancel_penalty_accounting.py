from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_cancel_booking_defers_refund_via_hutang_not_kas():
    service = read("backend/app/services/penjualan_mobil_service.py")

    assert "Defer refund as hutang DP jual mobil" in service
    assert "HutangSource.UANG_MUKA_PENJUALAN" in service
    assert "Refund pembatalan booking" not in service
    assert "transaksi.laba_tpm = penalti" in service
    assert "transaksi.harga_jual = Decimal(\"0\")" in service
    assert "transaksi.dp = Decimal(\"0\")" in service


def test_neraca_includes_refund_dp_in_uang_muka_penjualan():
    base = read("backend/app/services/reports/base.py")

    assert "dp_refund_hutang = get_debt_balance_by_unit([HutangSource.UANG_MUKA_PENJUALAN])" in base
    assert "customer_dp += dp_refund_hutang" in base


def test_laba_rugi_mobil_penalty_as_pendapatan_lainnya():
    base = read("backend/app/services/reports/base.py")
    laba_rugi = read("backend/app/services/reports/laba_rugi_service.py")
    ui = read("frontend/app/laporan/laba-rugi.tsx")

    assert "mobil_penalty_income" in base
    assert '"pendapatan_lainnya": mobil_penalty_income' in base
    assert "TransaksiPenjualanMobil.status_bayar == PaymentStatus.BATAL" in base
    assert 'm.get("pendapatan_lainnya", 0)' in laba_rugi
    assert "+ m_pendapatan_lainnya" in laba_rugi
    assert "Dana Penalti" in ui
    assert '"sharing_investor": sold_laba_investor' in base
    assert "laba_mobil_gross - laba_mobil_tpm" not in base.split('"sharing_investor"')[1].split("details")[0]


def test_hutang_menu_labels_refund_dp_source():
    hutang_ui = read("frontend/app/finance/hutang.tsx")
    keuangan = read("frontend/services/keuangan.ts")

    assert "UANG_MUKA_PENJUALAN: 'Refund DP Booking'" in hutang_ui
    assert "UANG_MUKA_PENJUALAN" in keuangan


def test_migration_adds_uang_muka_penjualan_enum():
    migration = read(
        "backend/alembic/versions/20260704_120000_add_uang_muka_penjualan_to_hutang_sumber_enum.py"
    )

    assert "UANG_MUKA_PENJUALAN" in migration


def test_cancel_booking_does_not_shadow_hutang_usaha_import():
    service = read("backend/app/services/penjualan_mobil_service.py")

    assert "from app.models.keuangan import HutangUsaha" not in service.split("def cancel_booking")[1]


def test_cancel_booking_auto_heals_hutang_enum_before_partial_refund():
    service = read("backend/app/services/penjualan_mobil_service.py")
    schema = read("backend/app/utils/db_schema.py")

    assert "ensure_hutang_sumber_enum" in schema
    assert "if refund > 0:" in service
    assert "ensure_hutang_sumber_enum(self.db)" in service