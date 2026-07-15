/**
 * Lightweight self-check (no Jest). Run: npx ts-node utils/receiptDocument.test.ts
 * or import from a one-off script.
 */
import { buildReceiptDocument } from './receiptDocument';
import { PrintSettings } from './printSettings';
import { PrintReceiptData, generateReceiptHTML } from './printReceipt';
import { generateBleReceiptText } from './generateBleReceiptText';

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
}

const baseSettings: PrintSettings = {
    companyName: 'TIGA PUTRA MOTOR',
    companyAddress: 'Jl. Raya Test',
    companyPhone: '08123456789',
    header: 'Bengkel Resmi',
    footer: 'Terima kasih',
    paperSize: '80mm',
    showQRCode: false,
    logoUri: null,
    printMethod: 'qz',
    webPrinterName: '',
    qrCodeBaseURL: 'https://example.com',
    template: 'standard',
};

const sampleData: PrintReceiptData = {
    type: 'bengkel',
    transactionNumber: 'TRX-001',
    antrian: 'A-12',
    date: new Date('2026-07-11T10:30:00'),
    customerName: 'Budi',
    cashierName: 'Sari',
    mechanicName: 'Andi',
    status: 'LUNAS',
    vehiclePlate: 'B 1234 XX',
    vehicleType: 'Matic',
    services: [{ description: 'Ganti Oli', quantity: 1, unitPrice: 50000, subtotal: 50000 }],
    parts: [{ description: 'Oli Shell', quantity: 1, unitPrice: 75000, subtotal: 75000 }],
    subtotal: 125000,
    discount: 5000,
    total: 120000,
    paid: 150000,
    change: 30000,
    paymentMethod: 'TUNAI',
    notes: 'Cek rem',
    showDiscount: true,
};

function run() {
    const doc = buildReceiptDocument(sampleData, baseSettings);
    const labels = doc.infoRows.map((r) => r.label);

    assert(labels.includes('Antrian:'), 'missing Antrian');
    assert(labels.includes('Kasir:'), 'missing Kasir');
    assert(labels.includes('Mekanik:'), 'missing Mekanik');
    assert(labels.includes('Status:'), 'missing Status');
    assert(labels.includes('Jenis:'), 'missing Jenis');
    assert(Boolean(doc.discount), 'missing discount');
    assert(Boolean(doc.change), 'missing change');
    assert(doc.notes === 'Cek rem', 'notes mismatch');
    assert(doc.isLunas === true, 'should be lunas');

    const filtered = buildReceiptDocument(
        { ...sampleData, antrian: '-', mechanicName: '-', paymentMethod: '-' },
        baseSettings,
    );
    const filteredLabels = filtered.infoRows.map((r) => r.label);
    assert(!filteredLabels.includes('Antrian:'), 'should skip dash antrian');
    assert(!filteredLabels.includes('Mekanik:'), 'should skip dash mechanic');
    assert(filtered.paymentMethod === undefined, 'should skip dash payment');

    const html = generateReceiptHTML(sampleData, baseSettings);
    const text = generateBleReceiptText(sampleData, baseSettings);

    for (const row of doc.infoRows) {
        assert(html.includes(row.label), `HTML missing ${row.label}`);
        assert(html.includes(row.value), `HTML missing ${row.value}`);
        assert(text.includes(row.label), `BLE text missing ${row.label}`);
        assert(text.includes(row.value), `BLE text missing ${row.value}`);
    }

    assert(html.includes('Kembalian'), 'HTML missing Kembalian');
    assert(text.includes('Kembalian'), 'BLE text missing Kembalian');
    assert(html.includes('Catatan:'), 'HTML missing Catatan');
    assert(text.includes('Catatan:'), 'BLE text missing Catatan');

    const diskonIdx = html.indexOf('Diskon');
    const totalIdx = html.indexOf('>TOTAL<');
    assert(diskonIdx > -1 && totalIdx > diskonIdx, 'Diskon should appear before TOTAL');

    const hidden = buildReceiptDocument({ ...sampleData, showDiscount: false }, baseSettings);
    assert(!hidden.discount, 'discount line should hide when showDiscount=false');
    assert(hidden.total === doc.total, 'TOTAL stays net even when discount line hidden');

    console.log('receiptDocument.test.ts: all checks passed');
}

run();
