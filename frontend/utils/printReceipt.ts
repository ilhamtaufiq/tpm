import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { PrintSettings } from './printSettings';

export interface PrintReceiptItem {
    description: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
}

export interface PrintReceiptData {
    type: 'bengkel' | 'jasa_angkut';
    transactionNumber: string;
    antrian?: string | number;
    date: Date;
    customerName: string;
    cashierName?: string;
    mechanicName?: string;
    status?: string;
    items?: PrintReceiptItem[]; // For backward compatibility
    services?: PrintReceiptItem[];
    parts?: PrintReceiptItem[];
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
            minimumFractionDigits: 0
        }).format(amount);
    };

    const formatDate = (date: Date) => {
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        const h = date.getHours().toString().padStart(2, '0');
        const min = date.getMinutes().toString().padStart(2, '0');
        return `${d}/${m}/${y} - ${h}:${min}`;
    };

    const renderItem = (item: PrintReceiptItem) => `
        <div style="margin-bottom: 4px;">
            <div style="font-size: 11px; text-transform: uppercase;">${item.description}</div>
            <div style="display: flex; justify-content: space-between; font-size: 11px;">
                <span>${item.quantity} x ${formatCurrency(item.unitPrice)}</span>
                <span>${formatCurrency(item.subtotal)}</span>
            </div>
        </div>
    `;

    let layananHTML = '';
    const services = data.services || (data.type === 'bengkel' ? [] : data.items || []);
    if (services.length > 0) {
        layananHTML = `
            <div style="text-align: center; font-size: 12px; margin-bottom: 8px;">LAYANAN</div>
            ${services.map(renderItem).join('')}
            <div style="border-top: 1px dashed #000; margin: 4px 0;"></div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 8px;">
                <span>Total</span>
                <span>${formatCurrency(services.reduce((acc, curr) => acc + curr.subtotal, 0))}</span>
            </div>
        `;
    }

    let sparePartHTML = '';
    const parts = data.parts || [];
    if (parts.length > 0) {
        sparePartHTML = `
            <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
            <div style="text-align: center; font-size: 12px; margin-bottom: 8px;">SPARE PART</div>
            ${parts.map(renderItem).join('')}
            <div style="border-top: 1px dashed #000; margin: 4px 0;"></div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 8px;">
                <span>Total</span>
                <span>${formatCurrency(parts.reduce((acc, curr) => acc + curr.subtotal, 0))}</span>
            </div>
        `;
    }

    const infoRow = (label: string, value: string | number | undefined) => value ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>${label}</span>
            <span>${value}</span>
        </div>
    ` : '';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=${paperWidth}, initial-scale=1.0">
            <style>
                @page { size: ${paperWidth} auto; margin: 0; }
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Courier New', Courier, monospace;
                    width: ${widthPx};
                    padding: 12px;
                    background: white;
                    color: black;
                    font-weight: 500;
                }
                .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
                .text-center { text-align: center; }
                .flex-between { display: flex; justify-content: space-between; }
                @media print { body { width: ${paperWidth}; } }
            </style>
        </head>
        <body>
            <!-- Header -->
            <div class="text-center">
                ${settings.logoUri ? `<img src="${settings.logoUri}" style="width: 60px; height: 60px; object-fit: contain; margin-bottom: 4px;" />` : ''}
                <div style="font-size: 16px; font-weight: bold; margin-bottom: 2px;">${settings.companyName || 'TIGA PUTRA MOTOR'}</div>
                <div style="font-size: 10px; margin-bottom: 2px;">${settings.companyAddress || 'jl.raya cianjur sukabumi km 5 ciwalen'}</div>
                <div style="font-size: 10px;">cianjur &nbsp; HP ${settings.companyPhone || '087720225244'}</div>
            </div>

            <div class="divider"></div>

            <!-- Transaction Info -->
            <div style="font-size: 11px;">
                ${infoRow('No Nota', data.transactionNumber)}
                ${infoRow('Antrian', data.antrian)}
                ${infoRow('Pelanggan', data.customerName)}
                ${infoRow('Tanggal', formatDate(data.date))}
                ${infoRow('Kasir', data.cashierName)}
                ${infoRow('Mekanik', data.mechanicName)}
            </div>

            <div class="divider"></div>

            <!-- Content -->
            ${layananHTML}
            ${sparePartHTML}

            <div class="divider"></div>

            <!-- Summary -->
            <div style="font-size: 11px;">
                ${infoRow('Status', data.status)}
                ${infoRow('Metode Bayar', data.paymentMethod)}
                ${infoRow('SubTotal', formatCurrency(data.subtotal))}
                ${data.discount ? infoRow('Diskon', '-' + formatCurrency(data.discount)) : ''}
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 12px; margin-top: 4px; border-top: 1px solid #000; padding-top: 4px;">
                    <span>Total</span>
                    <span>${formatCurrency(data.total)}</span>
                </div>
                ${data.paid !== undefined ? `
                <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                    <span>Dibayar</span>
                    <span>${formatCurrency(data.paid)}</span>
                </div>
                ` : ''}
                ${data.paid !== undefined && data.total > data.paid ? `
                <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 2px;">
                    <span>Sisa (Piutang)</span>
                    <span>${formatCurrency(data.total - data.paid)}</span>
                </div>
                ` : ''}
                ${data.change !== undefined && data.change > 0 ? infoRow('Kembalian', formatCurrency(data.change)) : ''}
            </div>

            <div class="divider"></div>
            
            ${data.vehiclePlate ? `
                <div style="font-size: 11px; margin-bottom: 8px;">${data.vehiclePlate}</div>
                <div class="divider"></div>
            ` : ''}

            <!-- Footer -->
            <div class="text-center" style="font-size: 10px; margin-top: 10px;">
                ${settings.footer || 'Terimakasih atas kepercayaan anda'}
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
            // For web, use a hidden iframe for more reliable printing
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            document.body.appendChild(iframe);

            const iframeDoc = iframe.contentWindow?.document;
            if (iframeDoc) {
                iframeDoc.open();
                iframeDoc.write(html);
                iframeDoc.close();

                // Wait for content to load
                iframe.onload = () => {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();
                    // Remove iframe after print dialog is closed
                    setTimeout(() => document.body.removeChild(iframe), 1000);
                };

                // Fallback for browsers where onload doesn't fire for iframe.document.write
                setTimeout(() => {
                    if (document.body.contains(iframe)) {
                        iframe.contentWindow?.focus();
                        iframe.contentWindow?.print();
                        setTimeout(() => {
                            if (document.body.contains(iframe)) document.body.removeChild(iframe);
                        }, 1000);
                    }
                }, 500);
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

        if (Platform.OS === 'web') {
            // For web, browsers handle "Save as PDF" through the print dialog
            // We use the same iframe logic as printReceipt
            return printReceipt(data, settings);
        }

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
