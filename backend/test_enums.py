from app.utils.constants import PaymentStatus, PaymentMethod
from pydantic import BaseModel
from typing import Optional

class TestSchema(BaseModel):
    status: Optional[PaymentStatus] = None
    method: Optional[PaymentMethod] = None

def test_enum_conversion():
    # Test lowercase conversion
    data = {"status": "belum_lunas", "method": "tunai"}
    obj = TestSchema(**data)
    print(f"Status: {obj.status} (type: {type(obj.status)})")
    print(f"Method: {obj.method} (type: {type(obj.method)})")
    
    assert obj.status == PaymentStatus.BELUM_LUNAS
    assert obj.method == PaymentMethod.TUNAI
    
    # Test uppercase
    data2 = {"status": "BELUM_LUNAS", "method": "TUNAI"}
    obj2 = TestSchema(**data2)
    print(f"Status2: {obj2.status}")
    assert obj2.status == PaymentStatus.BELUM_LUNAS

if __name__ == "__main__":
    try:
        test_enum_conversion()
        print("Success: Pydantic converts lowercase strings to Enum members correctly.")
    except Exception as e:
        print(f"FAILED: {e}")
