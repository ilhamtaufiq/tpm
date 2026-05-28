
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.utils.constants import ExpenseCategory

try:
    print(f"Defining Enum: {ExpenseCategory}")
    print(f"Members: {[e.name for e in ExpenseCategory]}")
    print(f"Values: {[e.value for e in ExpenseCategory]}")
    
    val = 'prive'
    print(f"Testing lookup: ExpenseCategory('{val}')")
    result = ExpenseCategory(val)
    print(f"Success: {result}")
    
    val_op = 'biaya_operasional'
    print(f"Testing lookup: ExpenseCategory('{val_op}')")
    result_op = ExpenseCategory(val_op)
    print(f"Success: {result_op}")

except Exception as e:
    print(f"FAIL: {e}")
