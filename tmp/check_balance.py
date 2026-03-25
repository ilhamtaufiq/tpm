
import os
import sys
from decimal import Decimal
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import Session

# Add backend app to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.database.session import engine_url
from app.models.keuangan import KasBank
from app.utils.constants import KasBankJenis

engine = create_engine(engine_url)
with Session(engine) as session:
    print("Checking Kas/Bank Balances...")
    for jenis in KasBankJenis:
        # Get the latest record for each jenis to find the current balance
        last_record = session.query(KasBank).filter(KasBank.jenis == jenis).order_by(KasBank.id.desc()).first()
        balance = last_record.saldo_sesudah if last_record else Decimal("0")
        print(f"Saldo {jenis.value}: {balance:,.2f}")
