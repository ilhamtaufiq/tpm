import { PrintReceiptData } from './printReceipt';

export type ReceiptBusinessUnit = 'bengkel' | 'jasa_angkut' | 'mobil';

function num(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function buildBengkelPrintData(source: any): PrintReceiptData {
    const services = (source?.detail_services || []).map((s: any) => {
        const qty = num(s.qty, 1);
        const unitPrice = num(s.harga);
        const subtotal = num(s.subtotal, unitPrice * qty);
        return {
            description: s.nama_jasa || s.nama || 'Jasa',
            quantity: qty,
            unitPrice: qty > 0 ? subtotal / qty : unitPrice,
            subtotal,
        };
    });

    const parts = (source?.detail_parts || []).map((p: any) => {
        const qty = num(p.qty, 1);
        const subtotal = num(p.subtotal);
        return {
            description: p.spare_part_nama || p.spare_part?.nama || 'Sparepart',
            quantity: qty,
            unitPrice: qty > 0 ? subtotal / qty : num(p.harga_jual),
            subtotal,
        };
    });

    const total = num(source?.grand_total, num(source?.total_biaya));
    const paid = num(source?.jumlah_bayar, num(source?.total_bayar));

    return {
        type: 'bengkel',
        transactionNumber: source?.nomor_transaksi || String(source?.id || '-'),
        publicReceiptToken: source?.public_receipt_token,
        antrian: source?.nomor_antrian,
        date: new Date(source?.created_at || source?.tanggal || new Date()),
        customerName: source?.nama_customer || source?.customer_nama || '-',
        cashierName: source?.kasir_nama || source?.user_nama || source?.created_by_nama,
        mechanicName: source?.mekanik_nama,
        status: source?.status_bayar,
        vehiclePlate: source?.nomor_plat || source?.plat_nomor,
        vehicleType: source?.jenis_kendaraan || source?.tipe_motor,
        services,
        parts,
        subtotal: num(source?.subtotal, total),
        discount: num(source?.diskon),
        total,
        paid,
        change: num(source?.kembalian),
        paymentMethod: source?.metode_bayar,
        notes: source?.catatan,
        showDiscount: true,
    };
}

export function buildJasaAngkutPrintData(source: any): PrintReceiptData {
    const ritase = Math.max(num(source?.ritase, 1), 1);
    const gross = num(source?.harga_jual, num(source?.pendapatan_kotor));
    const unitPrice = ritase > 0 ? gross / ritase : gross;
    const muatanLabel = source?.jenis_muatan ? ` · ${source.jenis_muatan}` : '';

    return {
        type: 'jasa_angkut',
        transactionNumber: source?.nomor_transaksi || String(source?.id || '-'),
        publicReceiptToken: String(source?.id || ''),
        date: new Date(source?.tanggal || source?.created_at || new Date()),
        customerName: source?.supir_nama || source?.supir_nama_manual || source?.supir?.nama || 'Umum',
        origin: source?.asal || '-',
        destination: source?.tujuan || '-',
        driverName: source?.supir_nama || source?.supir_nama_manual || source?.supir?.nama || '-',
        vehiclePlate: source?.nopol || source?.armada?.nopol,
        items: [{
            description: `Ritase ke-${ritase}: ${source?.asal || '-'} - ${source?.tujuan || '-'}${muatanLabel}`,
            quantity: ritase,
            unitPrice,
            subtotal: gross,
        }],
        subtotal: gross,
        total: gross,
        paid: num(source?.jumlah_bayar),
        paymentMethod: source?.metode_bayar,
        notes: source?.catatan,
        showDiscount: false,
    };
}

export function buildMobilPrintData(source: any): PrintReceiptData {
    const mobil = source?.mobil || {};
    const plate = mobil?.nomor_plat || source?.nomor_plat || '-';
    const total = num(source?.harga_jual, num(mobil?.harga_jual));
    const sisa = num(source?.sisa_bayar);
    const paid = num(source?.jumlah_bayar, Math.max(total - sisa, 0));
    const description = [
        'Mobil',
        mobil?.merek || source?.merek,
        mobil?.model || source?.model,
        mobil?.tahun || source?.tahun,
        plate !== '-' ? `(${plate})` : '',
    ].filter(Boolean).join(' ');

    return {
        type: 'mobil',
        transactionNumber: source?.nomor_transaksi || String(source?.id || '-'),
        publicReceiptToken: source?.public_receipt_token,
        date: new Date(source?.tanggal || source?.created_at || new Date()),
        customerName: source?.nama_pembeli || source?.customer_nama || '-',
        vehiclePlate: plate,
        vehicleType: [mobil?.merek || source?.merek, mobil?.model || source?.model].filter(Boolean).join(' '),
        items: [{
            description: description.trim() || 'Unit Mobil',
            quantity: 1,
            unitPrice: total,
            subtotal: total,
        }],
        subtotal: total,
        total,
        paid,
        paymentMethod: source?.metode_bayar,
        notes: source?.catatan,
        showDiscount: false,
    };
}

export function buildPrintReceiptDataForUnit(
    unit: ReceiptBusinessUnit,
    source: any,
): PrintReceiptData {
    if (unit === 'bengkel') return buildBengkelPrintData(source);
    if (unit === 'jasa_angkut') return buildJasaAngkutPrintData(source);
    return buildMobilPrintData(source);
}