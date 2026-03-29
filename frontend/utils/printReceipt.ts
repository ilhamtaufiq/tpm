import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PrintSettings } from './printSettings';

// Dynamically import thermal printer to avoid issues on non-android platforms
let BLEPrinter: any = null;
if (Platform.OS === 'android') {
    try {
        BLEPrinter = require('react-native-thermal-receipt-printer').BLEPrinter;
    } catch (e) {
        console.warn('Thermal Printer library not available');
    }
}

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
    // For CSS width on screen, we'll keep using px but strictly controlled
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
            <style>
                @page { 
                    size: ${paperWidth} auto; 
                    margin: 0; 
                }
                * { 
                    margin: 0; 
                    padding: 0; 
                    box-sizing: border-box; 
                    -webkit-print-color-adjust: exact;
                }
                html {
                    margin: 0;
                    padding: 0;
                    width: 100%;
                }
                body {
                    width: ${paperWidth} !important;
                    max-width: ${paperWidth} !important;
                    margin: 0 auto !important;
                    padding: 4mm 4mm !important; /* Increased horizontal padding for safer centering */
                    background: white;
                    color: black;
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 11px;
                    font-weight: 600;
                    line-height: 1.2;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .receipt-container {
                    width: 100%;
                    max-width: 100%;
                    margin: 0 auto;
                }
                .divider { 
                    width: 100%;
                    border-bottom: 1px dashed #000; 
                    margin: 3mm 0; 
                }
                .text-center { text-align: center; width: 100%; }
                .text-right { text-align: right; }
                .font-bold { font-weight: bold; }
                .flex-between { display: flex; justify-content: space-between; width: 100%; }
                
                @media print {
                    body {
                        padding: 2mm 2mm !important;
                        width: ${paperWidth} !important;
                        margin: 0 !important;
                    }
                }
            </style>
        </head>
        <body>
            <div class="receipt-container">
            <!-- Header -->
            <div class="text-center">
                ${settings.logoUri ? `<img src="${settings.logoUri}" style="width: 60px; height: 60px; display: block; margin: 0 auto 4px auto; object-fit: contain;" />` : ''}
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
                <div style="font-size: 11px; margin-bottom: 8px; text-align: center;">${data.vehiclePlate}</div>
                <div class="divider"></div>
            ` : ''}

            <!-- Footer -->
            <div class="text-center" style="font-size: 10px; margin-top: 10px;">
                ${settings.footer || 'Terimakasih atas kepercayaan anda'}
            </div>

            <div class="text-center" style="font-size: 8px; margin-top: 15px; color: #555; border-top: 1px dotted #ccc; padding-top: 5px;">
                Waktu Cetak: ${new Date().toLocaleString('id-ID', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    second: '2-digit' 
                }).replace(/\//g, '-')}
            </div>
        </div>
    </body>
    </html>
    `;
}

/**
 * Generate text for thermal printer (ESC/POS)
 */
export function generateThermalText(data: PrintReceiptData, settings: PrintSettings): string {
    const is80mm = settings.paperSize === '80mm';
    const divider = is80mm ? '------------------------------------------------' : '--------------------------------';
    
    const formatCurrencyLocal = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            minimumFractionDigits: 0
        }).format(amount).replace('Rp', '').trim();
    };

    const formatDateLocal = (date: Date) => {
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        const h = date.getHours().toString().padStart(2, '0');
        const min = date.getMinutes().toString().padStart(2, '0');
        return `${d}/${m}/${y} ${h}:${min}`;
    };

    let text = `<C><B>${settings.companyName || 'TIGA PUTRA MOTOR'}</B></C>\n`;
    text += `<C>${settings.companyAddress || 'jl.raya cianjur sukabumi km 5'}</C>\n`;
    text += `<C>HP: ${settings.companyPhone || '087720225244'}</C>\n`;
    text += `${divider}\n`;

    text += `No Nota  : ${data.transactionNumber}\n`;
    if (data.antrian) text += `Antrian  : ${data.antrian}\n`;
    text += `Plgn     : ${data.customerName}\n`;
    text += `Tanggal  : ${formatDateLocal(data.date)}\n`;
    if (data.cashierName) text += `Kasir    : ${data.cashierName}\n`;
    if (data.mechanicName) text += `Mekanik  : ${data.mechanicName}\n`;
    text += `${divider}\n`;

    // Items logic
    const renderItem = (item: PrintReceiptItem) => {
        // Adjust spacing based on paper size
        const description = item.description.substring(0, is80mm ? 30 : 18).toUpperCase();
        const priceStr = formatCurrencyLocal(item.unitPrice);
        const subtotalStr = formatCurrencyLocal(item.subtotal);
        const qtyStr = `${item.quantity} x ${priceStr}`;
        
        // Simple align
        return `${description}\n  ${qtyStr}\t${subtotalStr}\n`;
    };

    let layananHTML = '';
    const services = data.services || (data.type === 'bengkel' ? [] : data.items || []);
    if (services.length > 0) {
        text += `<C>LAYANAN</C>\n`;
        services.forEach(item => {
            text += renderItem(item);
        });
        text += `${divider}\n`;
        text += `Total Layanan: ${formatCurrencyLocal(services.reduce((acc, curr) => acc + curr.subtotal, 0))}\n`;
    }

    const parts = data.parts || [];
    if (parts.length > 0) {
        if (text.endsWith(divider + '\n')) {
            // avoid double divider
        } else {
            text += `${divider}\n`;
        }
        text += `<C>SPARE PART</C>\n`;
        parts.forEach(item => {
            text += renderItem(item);
        });
        text += `${divider}\n`;
        text += `Total Part: ${formatCurrencyLocal(parts.reduce((acc, curr) => acc + curr.subtotal, 0))}\n`;
    }

    text += `${divider}\n`;
    text += `SubTotal  : ${formatCurrencyLocal(data.subtotal)}\n`;
    if (data.discount) text += `Diskon    : -${formatCurrencyLocal(data.discount)}\n`;
    text += `<B>Total     : ${formatCurrencyLocal(data.total)}</B>\n`;

    if (data.paid !== undefined) {
        text += `Dibayar   : ${formatCurrencyLocal(data.paid)}\n`;
        if (data.total > data.paid) {
            text += `Sisa      : ${formatCurrencyLocal(data.total - data.paid)}\n`;
        }
    }
    if (data.change !== undefined && data.change > 0) {
        text += `Kembalian : ${formatCurrencyLocal(data.change)}\n`;
    }

    text += `${divider}\n`;
    
    if (data.paymentMethod) {
        text += `Metode    : ${data.paymentMethod}\n`;
        text += `${divider}\n`;
    }
    
    if (data.vehiclePlate) {
        text += `<C>${data.vehiclePlate}</C>\n`;
        text += `${divider}\n`;
    }

    text += `<C>${settings.footer || 'Terimakasih'}</C>\n`;
    text += `\n\n\n\n`; // Feed space

    return text;
}

/**
 * Print receipt using Expo Print
 */
export async function printReceipt(data: PrintReceiptData, settings: PrintSettings): Promise<void> {
    try {
        const html = generateReceiptHTML(data, settings);
        
        // Calculations for points (1/72 inch)
        // 80mm = 226.77 points
        // 58mm = 164.41 points
        const paperWidthPoints = settings.paperSize === '80mm' ? 227 : 164;

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
                    setTimeout(() => {
                        if (document.body.contains(iframe)) document.body.removeChild(iframe);
                    }, 2000);
                };

                // Fallback for browsers where onload doesn't fire for iframe.document.write
                setTimeout(() => {
                    if (document.body.contains(iframe)) {
                        iframe.contentWindow?.focus();
                        iframe.contentWindow?.print();
                        setTimeout(() => {
                            if (document.body.contains(iframe)) document.body.removeChild(iframe);
                        }, 2000);
                    }
                }, 800);
            }
        } else {
            // For mobile, check if direct thermal printer is connected via bluetooth
            if (Platform.OS === 'android' && BLEPrinter) {
                try {
                    const savedPrinter = await AsyncStorage.getItem('bluetooth_printer');
                    if (savedPrinter) {
                        const device = JSON.parse(savedPrinter);
                        // Initialize and connect (even if already connected, the library handles it)
                        await BLEPrinter.init();
                        await BLEPrinter.connectPrinter(device.inner_mac_address);
                        
                        // Generate thermal text and print
                        const thermalText = generateThermalText(data, settings);
                        await BLEPrinter.printText(thermalText);
                        return; // Successfully printed directly
                    }
                } catch (thermalError) {
                    console.warn('Failed to print to direct thermal printer, falling back to system print:', thermalError);
                    // Fallback to system print if direct printing fails
                }
            }

            // Fallback for mobile: use Expo Print (which shows the preview dialog)
            await Print.printAsync({
                html,
                width: paperWidthPoints,
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
        
        // Use points for Expo Print (72dpi)
        const paperWidthPoints = settings.paperSize === '80mm' ? 227 : 164;

        if (Platform.OS === 'web') {
            // For web, browsers handle "Save as PDF" through the print dialog
            return printReceipt(data, settings);
        }

        const { uri } = await Print.printToFileAsync({
            html,
            width: paperWidthPoints,
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

