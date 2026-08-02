/**
 * Add an "asset" sheet to the dummy template so it matches backend expectation.
 * Reads existing template, adds new sheet, writes back.
 */
const fs = require('fs');
const path = require('path');

const INPUT = path.resolve('C:\\Users\\asusg\\Downloads\\TPM_IMPORT_TEMPLATE_DUMY.xlsx');
const OUTPUT = path.resolve('C:\\laragon\\www\\tpm\\backend\\app\\services\\_template_from_dummy.xlsx');

// Read binary into buffer for openpyxl processing via Python
const child = require('child_process');

const pythonExe = 'C:\\laragon\\www\\tpm\\backend\\venv\\Scripts\\python.exe';

const script = `
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment, numbers
from datetime import date

wb = openpyxl.load_workbook(r'${INPUT.replace(/\\/g, '\\\\')}')

# Check if asset sheet already exists
if 'asset' not in wb.sheetnames:
    ws = wb.create_sheet('asset')

    # Headers (matching SHEET_HEADERS in data_import_service.py)
    headers = ['tanggal', 'nama asset', 'nominal', 'kategori', 'catatan']

    header_fill = PatternFill('solid', fgColor='1E3A8A')
    header_font = Font(bold=True, color='FFFFFF')
    example_fill = PatternFill('solid', fgColor='FEF3C7')

    for col, h in enumerate(headers, start=1):
        cell = ws.cell(1, col, h)
        cell.fill = header_fill
        cell.font = header_font

    # Example row - match what's in the file
    example_row = ['', 'Handphone', 600000, 'Elektronik', '']
    for col, val in enumerate(example_row, start=1):
        cell = ws.cell(2, col, val)
        cell.fill = example_fill

    print('Created asset sheet with headers:', headers)
else:
    print('Asset sheet already exists')

wb.save('${OUTPUT.replace(/\\/g, '\\\\')}')
print(f'Saved to {OUTPUT}')
`;

child.execSync(`"${pythonExe}" -c "${script.replace(/"/g, '\\"')}", { stdio: 'inherit' });
