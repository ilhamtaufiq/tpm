import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { PrintSettings } from './printSettings';

export interface PrintReceiptData {
    type: 'bengkel' | 'jasa_angkut';
    transactionNumber: string;
    date: Date;
    customerName: string;
    items: Array<{
        description: string;
        quantity?: number;
        unitPrice?: number;
        subtotal: number;
    }>;
    subtotal: number;
    tax?: number;
    discount?: number;
    total: number;
    paid?: number;
    change?: number;
    paymentMethod?: string;
    notes?: string;
    vehiclePlate?: string;
    vehicleType?: string;
    origin?: string;
    destination?: string;
    driverName?: string;
}

/**
 * Generate HTML for thermal receipt
 */
function generateReceiptHTML(data: PrintReceiptData, settings: PrintSettings): string {
    const paperWidth = settings.paperSize === '80mm' ? '80mm' : '58mm';
    const widthPx = settings.paperSize === '80mm' ? '302px' : '220px';

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    let itemsHTML = '';
    data.items.forEach(item => {
        const qtyPrice = item.quantity && item.unitPrice
            ? `<div style="font-size: 9px; color: #666;">${item.quantity} x ${formatCurrency(item.unitPrice)}</div>`
            : '';

        itemsHTML += `
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <div style="flex: 1; margin-right: 8px;">
                    <div style="font-size: 10px; font-weight: 500;">${item.description}</div>
                    ${qtyPrice}
                </div>
                <div style="font-size: 10px; font-weight: 600; text-align: right;">${formatCurrency(item.subtotal)}</div>
            </div>
        `;
    });

    const logoHTML = settings.logoUri
        ? `<img src="${settings.logoUri}" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 8px;" />`
        : '';

    const typeSpecificHTML = data.type === 'bengkel' && data.vehiclePlate ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 10px; color: #333;">No. Polisi</span>
            <span style="font-size: 10px; font-weight: 500; text-align: right;">${data.vehiclePlate}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 10px; color: #333;">Jenis Kendaraan</span>
            <span style="font-size: 10px; font-weight: 500; text-align: right;">${data.vehicleType || '-'}</span>
        </div>
    ` : data.type === 'jasa_angkut' && data.origin ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 10px; color: #333;">Rute</span>
            <span style="font-size: 10px; font-weight: 500; text-align: right;">${data.origin} → ${data.destination}</span>
        </div>
        ${data.driverName ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 10px; color: #333;">Supir</span>
            <span style="font-size: 10px; font-weight: 500; text-align: right;">${data.driverName}</span>
        </div>
        ` : ''}
    ` : '';

    const taxHTML = data.tax && data.tax > 0 ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 10px; color: #333;">Pajak</span>
            <span style="font-size: 10px; font-weight: 500;">${formatCurrency(data.tax)}</span>
        </div>
    ` : '';

    const discountHTML = data.discount && data.discount > 0 ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 10px; color: #333;">Diskon</span>
            <span style="font-size: 10px; font-weight: 500;">-${formatCurrency(data.discount)}</span>
        </div>
    ` : '';

    const paymentHTML = data.paymentMethod ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 10px; color: #333;">Metode Bayar</span>
            <span style="font-size: 10px; font-weight: 500;">${data.paymentMethod.toUpperCase()}</span>
        </div>
        ${data.paid && data.paid > 0 ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 10px; color: #333;">Dibayar</span>
            <span style="font-size: 10px; font-weight: 500;">${formatCurrency(data.paid)}</span>
        </div>
        ${data.change && data.change > 0 ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 10px; color: #333;">Kembalian</span>
            <span style="font-size: 10px; font-weight: 500;">${formatCurrency(data.change)}</span>
        </div>
        ` : ''}
        ` : ''}
    ` : '';

    const notesHTML = data.notes ? `
        <div style="border-top: 1px dashed #000; margin: 8px 0; padding-top: 8px;">
            <div style="font-size: 10px; color: #333; margin-bottom: 2px;">Catatan:</div>
            <div style="font-size: 9px; font-style: italic; color: #666;">${data.notes}</div>
        </div>
    ` : '';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=${paperWidth}, initial-scale=1.0">
            <style>
                @page {
                    size: ${paperWidth} auto;
                    margin: 0;
                }
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: 'Courier New', Courier, monospace;
                    width: ${widthPx};
                    padding: 12px;
                    background: white;
                }
                @media print {
                    body {
                        width: ${paperWidth};
                    }
                }
            </style>
        </head>
        <body>
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 8px;">
                ${logoHTML}
                <div style="font-size: 16px; font-weight: bold; margin-bottom: 4px;">${settings.companyName}</div>
                ${settings.header ? `<div style="font-size: 12px; font-weight: 600; margin-bottom: 4px;">${settings.header}</div>` : ''}
                <div style="font-size: 10px; color: #666; margin-bottom: 2px;">${settings.companyAddress}</div>
                <div style="font-size: 10px; color: #666; margin-bottom: 2px;">${settings.companyPhone}</div>
            </div>

            <div style="border-bottom: 1px dashed #000; margin: 8px 0;"></div>

            <!-- Transaction Info -->
            <div style="margin-bottom: 4px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-size: 10px; color: #333;">No. Transaksi</span>
                    <span style="font-size: 10px; font-weight: 500;">${data.transactionNumber}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-size: 10px; color: #333;">Tanggal</span>
                    <span style="font-size: 10px; font-weight: 500;">${formatDate(data.date)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-size: 10px; color: #333;">Jam</span>
                    <span style="font-size: 10px; font-weight: 500;">${formatTime(data.date)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-size: 10px; color: #333;">Customer</span>
                    <span style="font-size: 10px; font-weight: 500; text-align: right; max-width: 60%;">${data.customerName}</span>
                </div>
                ${typeSpecificHTML}
            </div>

            <div style="border-bottom: 1px dashed #000; margin: 8px 0;"></div>

            <!-- Items -->
            <div style="margin-bottom: 4px;">
                <div style="font-size: 11px; font-weight: bold; margin-bottom: 6px;">RINCIAN</div>
                ${itemsHTML}
            </div>

            <div style="border-bottom: 1px dashed #000; margin: 8px 0;"></div>

            <!-- Totals -->
            <div style="margin-bottom: 4px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-size: 10px; color: #333;">Subtotal</span>
                    <span style="font-size: 10px; font-weight: 500;">${formatCurrency(data.subtotal)}</span>
                </div>
                ${taxHTML}
                ${discountHTML}
                <div style="display: flex; justify-content: space-between; margin-top: 4px; padding-top: 4px; border-top: 1px solid #000;">
                    <span style="font-size: 12px; font-weight: bold;">TOTAL</span>
                    <span style="font-size: 12px; font-weight: bold;">${formatCurrency(data.total)}</span>
                </div>
                ${paymentHTML}
            </div>

            ${notesHTML}

            <div style="border-bottom: 1px dashed #000; margin: 8px 0;"></div>

            <!-- Footer -->
            <div style="text-align: center; margin-top: 4px;">
                ${settings.footer ? `<div style="font-size: 10px; margin-bottom: 4px;">${settings.footer}</div>` : ''}
                <div style="font-size: 8px; color: #999;">Struk ini dicetak otomatis</div>
            </div>
        </body>
        </html>
    `;
}

/**
 * Print receipt using Expo Print
 */
export async function printReceipt(data: PrintReceiptData, settings: PrintSettings): Promise<void> {
    try {
        const html = generateReceiptHTML(data, settings);

        if (Platform.OS === 'web') {
            // For web, open print dialog
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(html);
                printWindow.document.close();
                printWindow.focus();
                printWindow.print();
            }
        } else {
            // For mobile, use Expo Print
            await Print.printAsync({
                html,
                width: settings.paperSize === '80mm' ? 302 : 220
            });
        }
    } catch (error) {
        console.error('Print error:', error);
        throw new Error('Gagal mencetak struk. Pastikan printer terhubung.');
    }
}

/**
 * Save receipt as PDF and share
 */
export async function saveReceiptPDF(data: PrintReceiptData, settings: PrintSettings): Promise<void> {
    try {
        const html = generateReceiptHTML(data, settings);

        const { uri } = await Print.printToFileAsync({
            html,
            width: settings.paperSize === '80mm' ? 302 : 220
        });

        // Share the PDF
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, {
                mimeType: 'application/pdf',
                dialogTitle: `Struk ${data.transactionNumber}`,
                UTI: 'com.adobe.pdf'
            });
        } else {
            throw new Error('Sharing tidak tersedia di perangkat ini');
        }
    } catch (error) {
        console.error('Save PDF error:', error);
        throw new Error('Gagal menyimpan struk sebagai PDF');
    }
}
