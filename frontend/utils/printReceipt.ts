import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { PrintSettings, printSettingsService } from './printSettings';
import { getPaperDimensions, PaperDimensions } from './paperSize';
import { printHtmlInBrowser } from './printHtmlBrowser';
import { printHtmlOnWeb } from './printHtmlWeb';
import { buildPublicReceiptUrl } from './publicReceiptUrl';
import { ensureLogoBase64, buildReceiptLogoHtml } from './receiptLogo';
import { buildReceiptDocument } from './receiptDocument';
import { formatReceiptCurrency } from './receiptFormatters';
import { prepareReceiptHtml } from './prepareReceiptHtml';
import { executeAndroidThermalPrint } from './androidThermalPrint';

export { ensureLogoBase64 } from './receiptLogo';

export interface PrintReceiptItem {
    description: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
}

export interface PrintReceiptData {
    type: 'bengkel' | 'jasa_angkut' | 'mobil';
    transactionNumber: string;
    publicReceiptToken?: string;
    antrian?: string | number;
    date: Date;
    customerName: string;
    cashierName?: string;
    mechanicName?: string;
    status?: string;
    items?: PrintReceiptItem[];
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
    showDiscount?: boolean;
    vehiclePlate?: string;
    vehicleType?: string;
    origin?: string;
    destination?: string;
    driverName?: string;
}

export interface ReceiptHtmlOptions {
    qrImageDataUrl?: string | null;
}

function escapeHtml(value: string | number | undefined | null): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildReceiptQrHtml(
    data: PrintReceiptData,
    settings: PrintSettings,
    paper: PaperDimensions,
    qrImageDataUrl?: string | null,
): string {
    if (!settings.showQRCode) return '';

    const qrType = data.type === 'mobil' ? 'mobil' : data.type;
    const receiptId = data.publicReceiptToken || data.transactionNumber;
    const receiptUrl = buildPublicReceiptUrl(qrType, receiptId, settings.qrCodeBaseURL);

    const encoded = encodeURIComponent(receiptUrl);
    const qr = paper.qrSizePx;
    // Prefer offline/inlined data URL (Android BLE). Fall back to API for web/QZ.
    const imgSrc = qrImageDataUrl
        ? qrImageDataUrl.replace(/"/g, '&quot;')
        : Platform.OS === 'web'
            ? `https://api.qrserver.com/v1/create-qr-code/?size=${qr}x${qr}&data=${encoded}`
            : '';

    if (!imgSrc) {
        return `
<div class="center" style="margin-top:8px">
    <div style="font-size:${paper.fontSmall}px">Scan struk digital online</div>
</div>`;
    }

    return `
<div class="center" style="margin-top:8px">
    <img src="${imgSrc}" width="${qr}" height="${qr}" alt="QR Struk" style="display:block;margin:0 auto" />
    <div style="font-size:${paper.fontSmall}px;margin-top:4px">Scan untuk lihat struk online</div>
</div>`;
}

export function generateReceiptHTML(
    data: PrintReceiptData,
    settings: PrintSettings,
    options?: ReceiptHtmlOptions,
): string {
    const paper = getPaperDimensions(settings.paperSize);
    const doc = buildReceiptDocument(data, settings);
    const paperWidth = `${paper.widthMm}mm`;
    const fsB = paper.fontBase;
    const fsS = paper.fontSmall;
    const fsTitle = paper.fontTitle;
    const fsFooter = paper.fontFooter;
    const pad = paper.padding;
    const is80mm = paper.paperSize === '80mm';

    const infoRowsHtml = doc.infoRows.map((row) => `
        <tr><td style="font-size:${fsB}px;padding:1px 0">${escapeHtml(row.label)}</td><td style="font-size:${fsB}px;padding:1px 0;text-align:right">${escapeHtml(row.value)}</td></tr>
    `).join('');

    const sectionsHtml = doc.sections.map((section, index) => {
        const rows = section.items.map((item) => `
            <tr><td colspan="2" style="font-size:${fsB}px;padding:1px 0;font-weight:bold">${escapeHtml(String(item.description || '-').toUpperCase())}</td></tr>
            <tr>
                <td style="font-size:${fsB}px;padding:1px 0">${item.quantity} x ${escapeHtml(formatReceiptCurrency(item.unitPrice))}</td>
                <td style="font-size:${fsB}px;padding:1px 0;text-align:right">${escapeHtml(formatReceiptCurrency(item.subtotal))}</td>
            </tr>
        `).join('');
        const divider = index > 0 ? '<div class="divider"></div>' : '';
        return `${divider}<div style="text-align:center;font-size:${fsB}px;font-weight:bold;padding:2px 0;text-transform:uppercase">--- ${escapeHtml(section.title)} ---</div><table style="width:100%;border-collapse:collapse">${rows}</table>`;
    }).join('');

    const logoHtml = buildReceiptLogoHtml(settings.logoUri, paper.logoMaxPx);

    const qrHtml = doc.showQr && doc.qrUrl
        ? buildReceiptQrHtml(data, settings, paper, options?.qrImageDataUrl)
        : '';

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
@page { size: ${paperWidth} auto; margin: 0; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Courier New',monospace; font-size:${fsB}px; padding:${pad}; background:#fff; color:#000; width:${paper.widthPx}px; max-width:${paperWidth}; }
.divider { border-top:1px dashed #000; margin:4px 0; }
.center { text-align:center; }
.bold { font-weight:bold; }
table { width:100%; border-collapse:collapse; }
</style></head><body>
<div class="center">${logoHtml}</div>
<div class="center bold" style="font-size:${fsTitle}px">${escapeHtml(doc.companyName)}</div>
${doc.headerText ? `<div class="center" style="font-size:${fsS}px">${escapeHtml(doc.headerText)}</div>` : ''}
${doc.address ? `<div class="center" style="font-size:${fsS}px">${escapeHtml(doc.address)}</div>` : ''}
${doc.phone ? `<div class="center" style="font-size:${fsS}px">Telp: ${escapeHtml(doc.phone)}</div>` : ''}
<div class="divider"></div>
<table>${infoRowsHtml}</table>
<div class="divider"></div>
${sectionsHtml}
<div class="divider"></div>
<table>
<tr><td style="font-size:${fsB}px;font-weight:bold">SUBTOTAL</td><td style="font-size:${fsB}px;text-align:right;font-weight:bold">${escapeHtml(doc.subtotal)}</td></tr>
${doc.discount ? `<tr><td style="font-size:${fsB}px">Diskon</td><td style="font-size:${fsB}px;text-align:right">-${escapeHtml(doc.discount)}</td></tr>` : ''}
<tr><td style="font-size:${is80mm ? 14 : 12}px;font-weight:bold">TOTAL</td><td style="font-size:${is80mm ? 14 : 12}px;text-align:right;font-weight:bold">${escapeHtml(doc.total)}</td></tr>
${doc.paid ? `<tr><td style="font-size:${fsB}px">Dibayar</td><td style="font-size:${fsB}px;text-align:right">${escapeHtml(doc.paid)}</td></tr>` : ''}
${doc.sisa ? `<tr><td style="font-size:${fsB}px;color:#EF4444;font-weight:bold">SISA</td><td style="font-size:${fsB}px;text-align:right;color:#EF4444;font-weight:bold">${escapeHtml(doc.sisa)}</td></tr>` : '<tr><td colspan="2" style="text-align:center;font-weight:bold;padding-top:4px">LUNAS</td></tr>'}
${doc.change ? `<tr><td style="font-size:${fsB}px">Kembalian</td><td style="font-size:${fsB}px;text-align:right">${escapeHtml(doc.change)}</td></tr>` : ''}
${doc.paymentMethod ? `<tr><td style="font-size:${fsS}px">Metode Bayar:</td><td style="font-size:${fsS}px;text-align:right">${escapeHtml(doc.paymentMethod)}</td></tr>` : ''}
</table>
${doc.notes ? `<div class="divider"></div><div style="font-size:${fsS}px">Catatan: ${escapeHtml(doc.notes)}</div>` : ''}
<div class="divider"></div>
${qrHtml}
<div class="center" style="font-size:${fsFooter}px">${escapeHtml(doc.footer)}</div>
</body></html>`;
}

export async function printReceipt(data: PrintReceiptData, settings?: PrintSettings): Promise<void> {
    try {
        // Android BLE: native ESC/POS only (no WebView/HTML raster).
        if (Platform.OS === 'android') {
            const activeSettings = settings ?? await printSettingsService.getSettings();
            const normalized: PrintSettings = {
                ...activeSettings,
                paperSize: getPaperDimensions(activeSettings.paperSize).paperSize,
            };
            await executeAndroidThermalPrint(data, normalized);
            return;
        }

        const { html, settings: processedSettings } = await prepareReceiptHtml(data, settings);
        const paperWidthPoints = getPaperDimensions(processedSettings.paperSize).widthPx;

        if (Platform.OS === 'web') {
            await printHtmlOnWeb(html, processedSettings);
        } else {
            await Print.printAsync({ html, width: paperWidthPoints });
        }
    } catch (error: any) {
        console.error('Print error:', error);
        const detail = error?.message ? ` (${error.message})` : '';
        const hint = Platform.OS === 'web'
            ? 'Cek koneksi QZ Tray di Pengaturan Cetak.'
            : Platform.OS === 'android'
                ? 'Pastikan printer Bluetooth dipair, menyala, dan dekat. Coba Test Print di Pengaturan Cetak.'
                : 'Pastikan printer terhubung.';
        throw new Error(`Gagal mencetak struk. ${hint}${detail}`);
    }
}

export async function saveReceiptPDF(data: PrintReceiptData, settings?: PrintSettings): Promise<void> {
    try {
        const activeSettings = settings ?? await printSettingsService.getSettings();
        const { html, settings: processedSettings } = await prepareReceiptHtml(data, activeSettings);
        const paperWidthPoints = getPaperDimensions(processedSettings.paperSize).widthPx;

        if (Platform.OS === 'web') {
            return printHtmlInBrowser(html, getPaperDimensions(processedSettings.paperSize).paperSize);
        }

        const { uri } = await Print.printToFileAsync({ html, width: paperWidthPoints });
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Struk ${data.transactionNumber}`, UTI: 'com.adobe.pdf' });
        } else {
            throw new Error('Sharing tidak tersedia di perangkat ini');
        }
    } catch (error) {
        console.error('Save PDF error:', error);
        throw new Error('Gagal menyimpan struk sebagai PDF');
    }
}
