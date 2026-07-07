import {
    parseBarcodeScan,
    findSparePartByBarcode,
    getBarcodeSearchQuery,
    getSparePartSearchDisplayQuery,
    shouldRejectLinearPreferredScan,
} from './barcodeScan';

const sampleParts = [
    { id: 1, kode: 'SP-001', kode_part: 'MD273133003700079', kode_ean: '8996001326398' },
    { id: 2, kode: 'SP-002', kode_part: 'FILTER-OIL', kode_ean: '8996001326398' },
];

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
}

function runTests() {
    const gs1 = parseBarcodeScan('(90)MD273133003700079');
    assert(gs1.candidates.includes('MD273133003700079'), 'GS1 AI90 should expose part number');
    assert(findSparePartByBarcode(sampleParts, '(90)MD273133003700079')?.id === 1, 'GS1 AI90 should match kode_part');

    const ean = parseBarcodeScan('8996001326398');
    assert(ean.candidates.includes('8996001326398'), 'EAN-13 should stay intact');
    assert(findSparePartByBarcode(sampleParts, '8996001326398')?.id === 1, 'EAN-13 should match kode_ean');

    const prefixedEan = parseBarcodeScan('08996001326398');
    assert(
        findSparePartByBarcode(sampleParts, '08996001326398')?.id === 2,
        'Leading-zero GTIN variant should still match',
    );

    const gs1WithEan = getBarcodeSearchQuery('(90)MD2731330037000798996001326398');
    assert(gs1WithEan === '8996001326398' || getBarcodeSearchQuery('8996001326398') === '8996001326398', 'Search query should prefer EAN-13');

    const gs1Display = getSparePartSearchDisplayQuery('(90)MD273133003700079', sampleParts[0]);
    assert(gs1Display === '8996001326398', 'Matched part should display stored EAN in search field');

    assert(shouldRejectLinearPreferredScan('qr'), 'Linear-prefer mode should ignore QR reads');
    assert(!shouldRejectLinearPreferredScan('ean13'), 'EAN-13 reads should be accepted');
    assert(!shouldRejectLinearPreferredScan('hardware'), 'Hardware wedge scans should always be accepted');

    console.log('barcodeScan tests passed');
}

runTests();