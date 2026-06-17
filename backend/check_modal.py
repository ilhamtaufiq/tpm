import openpyxl
from decimal import Decimal

wb = openpyxl.load_workbook(r'c:\laragon\www\tpm\stock 10.4.26-1775809768186.xlsx', data_only=True)
ws = wb.active

tanpa_stok_text = 0  # cells with "Tanpa Stok" text
tanpa_stok_text_modal = Decimal("0")
numeric_zero = 0     # cells with number 0
has_stock = 0        # cells with stock > 0
total_items = 0

for row in ws.iter_rows(min_row=2, values_only=True):
    if not any(row):
        continue
    total_items += 1
    
    stok_raw = row[5]
    harga_beli = Decimal(str(row[3] or 0))
    stok_str = str(stok_raw).strip() if stok_raw is not None else ""
    
    try:
        stok_val = int(stok_str) if stok_str else 0
        if stok_val == 0:
            numeric_zero += 1
        else:
            has_stock += 1
    except ValueError:
        tanpa_stok_text += 1
        tanpa_stok_text_modal += harga_beli
        print(f"  Tanpa Stok: {str(row[1])[:50]} | stok_raw='{stok_raw}' | hb={harga_beli}")

print(f"\n=== SUMMARY ===")
print(f"Total items:           {total_items}")
print(f"Has stock (>0):        {has_stock}")
print(f"Numeric zero (0):      {numeric_zero}")
print(f"'Tanpa Stok' text:     {tanpa_stok_text}")
print(f"'Tanpa Stok' modal:    Rp {tanpa_stok_text_modal:,.0f}")
print(f"\nExpected total: 120,175,538 + {tanpa_stok_text_modal:,.0f} = Rp {120175538 + tanpa_stok_text_modal:,.0f}")
print(f"Excel total:    Rp 124,288,980")
