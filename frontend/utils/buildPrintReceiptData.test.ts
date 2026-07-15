/**
 * Lightweight self-check. Run: npx ts-node --transpile-only utils/buildPrintReceiptData.test.ts
 */
import { buildBengkelPrintData } from './buildPrintReceiptData';

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
}

function run() {
    const base = {
        nomor_transaksi: 'TRX-1',
        subtotal: 100000,
        diskon: 15000,
        grand_total: 85000,
        jumlah_bayar: 85000,
        detail_services: [],
        detail_parts: [],
    };

    const shown = buildBengkelPrintData({ ...base, tampilkan_diskon_struk: true });
    assert(shown.showDiscount === true, 'should show discount when flag true');
    assert(shown.discount === 15000, 'discount amount mapped');
    assert(shown.total === 85000, 'total is net grand_total');

    const hidden = buildBengkelPrintData({ ...base, tampilkan_diskon_struk: false });
    assert(hidden.showDiscount === false, 'should hide discount when flag false');
    assert(hidden.total === 85000, 'total stays net when hidden');

    const legacy = buildBengkelPrintData(base);
    assert(legacy.showDiscount === true, 'legacy rows default to show discount');

    console.log('buildPrintReceiptData.test.ts: all checks passed');
}

run();
