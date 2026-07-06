import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PrintSettings, printSettingsService } from './printSettings';
import { getPaperDimensions, PaperDimensions } from './paperSize';
import { printHtmlInBrowser } from './printHtmlBrowser';
import { printHtmlOnWeb } from './printHtmlWeb';
import { buildPublicReceiptUrl } from './publicReceiptUrl';
import { ensureLogoBase64, buildReceiptLogoHtml } from './receiptLogo';
import { printBleReceipt } from './printBleReceipt';
import {
    formatReceiptCurrency,
    formatReceiptDate,
    getReceiptSections,
} from './receiptFormatters';

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

function buildReceiptQrHtml(
    data: PrintReceiptData,
    settings: PrintSettings,
    paper: PaperDimensions,
): string {
    if (!settings.showQRCode) return '';

    const qrType = data.type === 'mobil' ? 'mobil' : data.type;
    const receiptId = data.publicReceiptToken || data.transactionNumber;
    const receiptUrl = buildPublicReceiptUrl(qrType, receiptId, settings.qrCodeBaseURL);

    const encoded = encodeURIComponent(receiptUrl);
    const qr = paper.qrSizePx;
    return `
<div class="center" style="margin-top:8px">
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=${qr}x${qr}&data=${encoded}" width="${qr}" height="${qr}" alt="QR Struk" />
    <div style="font-size:${paper.fontSmall}px;margin-top:4px">Scan untuk lihat struk online</div>
</div>`;
}

export function generateReceiptHTML(data: PrintReceiptData, settings: PrintSettings): string {
    const paper = getPaperDimensions(settings.paperSize);
    const paperWidth = `${paper.widthMm}mm`;
    const fsB = paper.fontBase;
    const fsS = paper.fontSmall;
    const fsTitle = paper.fontTitle;
    const fsFooter = paper.fontFooter;
    const pad = paper.padding;
    const is80mm = paper.paperSize === '80mm';

    const fmt = formatReceiptCurrency;
    const formatDate = formatReceiptDate;

    const infoRow = (label: string, value: string | number | undefined) => value ? `
        <tr><td style="font-size:${fsB}px;padding:1px 0">${label}</td><td style="font-size:${fsB}px;padding:1px 0;text-align:right">${value}</td></tr>
    ` : '';

    const renderItems = (items: PrintReceiptItem[] | undefined, title: string) => {
        if (!items || items.length === 0) return '';
        const rows = items.map(i => `
            <tr><td colspan="2" style="font-size:${fsB}px;padding:1px 0;font-weight:bold">${String(i.description || '-').toUpperCase()}</td></tr>
            <tr>
                <td style="font-size:${fsB}px;padding:1px 0">${i.quantity} x ${fmt(i.unitPrice)}</td>
                <td style="font-size:${fsB}px;padding:1px 0;text-align:right">${fmt(i.subtotal)}</td>
            </tr>
        `).join('');
        return `<div style="text-align:center;font-size:${fsB}px;font-weight:bold;padding:2px 0;text-transform:uppercase">--- ${title} ---</div><table style="width:100%;border-collapse:collapse">${rows}</table>`;
    };

    const { services, parts, servicesTitle } = getReceiptSections(data);
    const servicesHtml = services.length > 0 ? renderItems(services, servicesTitle) : '';
    const partsHtml = parts.length > 0 ? renderItems(parts, 'SPAREPART') : '';

    const logoHtml = buildReceiptLogoHtml(settings.logoUri, paper.logoMaxPx);

    const sisa = data.total - (data.paid || 0);

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
<div class="center bold" style="font-size:${fsTitle}px">${settings.companyName || 'TIGA PUTRA MOTOR'}</div>
${settings.header ? `<div class="center" style="font-size:${fsS}px">${settings.header}</div>` : ''}
<div class="center" style="font-size:${fsS}px">${settings.companyAddress || ''}</div>
<div class="center" style="font-size:${fsS}px">Telp: ${settings.companyPhone || ''}</div>
<div class="divider"></div>
<table>${infoRow('No. Nota:', data.transactionNumber)}${infoRow('Tanggal:', formatDate(data.date))}${infoRow('Pelanggan:', data.customerName)}${data.vehiclePlate ? infoRow('No. Polisi:', data.vehiclePlate) : ''}${data.type === 'jasa_angkut' ? infoRow('Asal:', data.origin) + infoRow('Tujuan:', data.destination) + infoRow('Sopir:', data.driverName) : ''}</table>
<div class="divider"></div>
${servicesHtml}
${servicesHtml && partsHtml ? '<div class="divider"></div>' : ''}
${partsHtml}
<div class="divider"></div>
<table><tr><td style="font-size:${fsB}px;font-weight:bold">SUBTOTAL</td><td style="font-size:${fsB}px;text-align:right;font-weight:bold">${fmt(data.subtotal)}</td></tr></table>
<div class="divider"></div>
<table>
<tr><td style="font-size:${is80mm ? 14 : 12}px;font-weight:bold">TOTAL</td><td style="font-size:${is80mm ? 14 : 12}px;text-align:right;font-weight:bold">${fmt(data.total)}</td></tr>
${data.discount && data.showDiscount !== false ? `<tr><td style="font-size:${fsB}px">Diskon</td><td style="font-size:${fsB}px;text-align:right">-${fmt(data.discount)}</td></tr>` : ''}
${data.paid !== undefined ? `<tr><td style="font-size:${fsB}px">Dibayar</td><td style="font-size:${fsB}px;text-align:right">${fmt(data.paid)}</td></tr>` : ''}
${sisa > 0 ? `<tr><td style="font-size:${fsB}px;color:#EF4444;font-weight:bold">SISA</td><td style="font-size:${fsB}px;text-align:right;color:#EF4444;font-weight:bold">${fmt(sisa)}</td></tr>` : '<tr><td colspan="2" style="text-align:center;font-weight:bold;padding-top:4px">LUNAS</td></tr>'}
${data.paymentMethod ? `<tr><td style="font-size:${fsS}px">Metode Bayar:</td><td style="font-size:${fsS}px;text-align:right">${String(data.paymentMethod).toUpperCase()}</td></tr>` : ''}
</table>
<div class="divider"></div>
${buildReceiptQrHtml(data, settings, paper)}
<div class="center" style="font-size:${fsFooter}px">${settings.footer || 'Terima kasih'}</div>
</body></html>`;
}

export async function printReceipt(data: PrintReceiptData, settings?: PrintSettings): Promise<void> {
    try {
        const activeSettings = settings ?? await printSettingsService.getSettings();
        const normalizedSettings = {
            ...activeSettings,
            paperSize: getPaperDimensions(activeSettings.paperSize).paperSize,
        };
        const base64Logo = normalizedSettings.logoUri
            ? await ensureLogoBase64(normalizedSettings.logoUri)
            : null;
        const processedSettings = { ...normalizedSettings, logoUri: base64Logo };
        const html = generateReceiptHTML(data, processedSettings);
        const paperWidthPoints = getPaperDimensions(normalizedSettings.paperSize).widthPx;

        if (Platform.OS === 'web') {
            await printHtmlOnWeb(html, normalizedSettings);
        } else {
            if (Platform.OS === 'android') {
                try {
                    const savedPrinter = await AsyncStorage.getItem('bluetooth_printer');
                    if (savedPrinter) {
                        const device = JSON.parse(savedPrinter);
                        await printBleReceipt(data, processedSettings, device.inner_mac_address);
                        return;
                    }
                } catch (e) {
                    console.warn('BLE print failed:', e);
                }
            }
            await Print.printAsync({ html, width: paperWidthPoints });
        }
    } catch (error: any) {
        console.error('Print error:', error);
        const detail = error?.message ? ` (${error.message})` : '';
        throw new Error(`Gagal mencetak struk. Cek koneksi QZ Tray di Pengaturan Cetak atau pastikan printer terhubung.${detail}`);
    }
}

export async function saveReceiptPDF(data: PrintReceiptData, settings?: PrintSettings): Promise<void> {
    try {
        const activeSettings = settings ?? await printSettingsService.getSettings();
        const base64Logo = activeSettings.logoUri
            ? await ensureLogoBase64(activeSettings.logoUri)
            : null;
        const processedSettings = { ...activeSettings, logoUri: base64Logo };
        const html = generateReceiptHTML(data, processedSettings);
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
