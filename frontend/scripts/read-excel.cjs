const XLSX = require('xlsx');
const wb = XLSX.readFile('C:\\Users\\asusg\\Downloads\\TPM_IMPORT_TEMPLATE_DUMY.xlsx');
console.log('Sheet names:', wb.SheetNames);
wb.SheetNames.forEach(name => {
  const ws = wb.Sheets[name];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  console.log('\n=== Sheet:', name, '===');
  console.log('Headers:', JSON.stringify(data[0]));
  console.log('Sample rows:');
  data.slice(1, 6).forEach((row, i) => console.log('Row ' + (i + 2) + ':', JSON.stringify(row)));
  console.log('Total rows:', data.length);
});
