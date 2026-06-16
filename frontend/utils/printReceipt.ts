import { Platform, Image } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PrintSettings } from './printSettings';
import { printHtmlInBrowser } from './printHtmlBrowser';
import { printHtmlViaQz } from './qzTray';

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

export function generateReceiptHTML(data: PrintReceiptData, settings: PrintSettings): string {
    const is80mm = settings.paperSize !== '58mm';
    const paperWidth = is80mm ? '80mm' : '58mm';
    const fsB = is80mm ? 11 : 10;
    const fsS = is80mm ? 10 : 9;
    const fsTitle = is80mm ? 16 : 14;
    const fsFooter = is80mm ? 10 : 9;
    const pad = is80mm ? '4mm' : '2mm';

    const fmt = (n: number) => 'Rp' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    const formatDate = (date: Date) => {
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        const h = date.getHours().toString().padStart(2, '0');
        const min = date.getMinutes().toString().padStart(2, '0');
        return `${d}/${m}/${y} - ${h}:${min}`;
    };

    const infoRow = (label: string, value: string | number | undefined) => value ? `
        <tr><td style="font-size:${fsB}px;padding:1px 0">${label}</td><td style="font-size:${fsB}px;padding:1px 0;text-align:right">${value}</td></tr>
    ` : '';

    const renderItems = (items: PrintReceiptItem[] | undefined, title: string) => {
        if (!items || items.length === 0) return '';
        const rows = items.map(i => `
            <tr><td colspan="2" style="font-size:${fsB}px;padding:1px 0;font-weight:bold">${i.description.toUpperCase()}</td></tr>
            <tr>
                <td style="font-size:${fsB}px;padding:1px 0">${i.quantity} x ${fmt(i.unitPrice)}</td>
                <td style="font-size:${fsB}px;padding:1px 0;text-align:right">${fmt(i.subtotal)}</td>
            </tr>
        `).join('');
        return `<div style="text-align:center;font-size:${fsB}px;font-weight:bold;padding:2px 0;text-transform:uppercase">--- ${title} ---</div><table style="width:100%;border-collapse:collapse">${rows}</table>`;
    };

    const services = data.services || (data.type === 'bengkel' ? [] : data.items || []);
    const parts = data.parts || [];
    const items = data.items || [];
    const servicesHtml = (services.length > 0)
        ? renderItems(services, 'JASA')
        : (data.type !== 'bengkel' && items.length > 0)
            ? renderItems(items, 'ITEMS')
            : '';
    const partsHtml = parts.length > 0 ? renderItems(parts, 'SPAREPART') : '';

    const logoHtml = settings.logoUri && settings.logoUri.startsWith('data:')
        ? `<img src="${settings.logoUri}" style="max-width:80px;height:auto;display:block;margin:0 auto 6px" />`
        : '';

    const sisa = data.total - (data.paid || 0);

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Courier New',monospace; font-size:${fsB}px; padding:${pad}; background:#fff; color:#000; width:${paperWidth}; }
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
<table>${infoRow('No. Nota:', data.transactionNumber)}${infoRow('Tanggal:', formatDate(data.date))}${infoRow('Pelanggan:', data.customerName)}${data.vehiclePlate ? infoRow('No. Polisi:', data.vehiclePlate) : ''}</table>
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
<div class="center" style="font-size:${fsFooter}px">${settings.footer || 'Terima kasih'}</div>
</body></html>`;
}

export async function ensureLogoBase64(uri: string | null): Promise<string | null> {
    if (!uri) return null;
    let targetUri = uri;
    if (uri === 'tpm_default') {
        const asset = Image.resolveAssetSource(require('../assets/logo_tpm.png'));
        targetUri = asset.uri;
    }
    if (targetUri.startsWith('data:')) return targetUri;
    try {
        const response = await fetch(targetUri);
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(uri);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn('Failed to convert logo to base64:', e);
        return uri;
    }
}

export async function printReceipt(data: PrintReceiptData, settings: PrintSettings): Promise<void> {
    try {
        const base64Logo = await ensureLogoBase64(settings.logoUri);
        const processedSettings = { ...settings, logoUri: base64Logo };
        const html = generateReceiptHTML(data, processedSettings);
        const paperWidthPoints = settings.paperSize === '80mm' ? 227 : 164;

        if (Platform.OS === 'web') {
            const printedByQz = await printHtmlViaQz(html, {
                printerName: settings.webPrinterName,
                pageWidthPx: settings.paperSize === '80mm' ? 302 : 220,
            });
            if (!printedByQz) await printHtmlInBrowser(html);
        } else {
            if (Platform.OS === 'android' && BLEPrinter) {
                try {
                    const savedPrinter = await AsyncStorage.getItem('bluetooth_printer');
                    if (savedPrinter) {
                        const device = JSON.parse(savedPrinter);
                        await BLEPrinter.init();
                        await BLEPrinter.connectPrinter(device.inner_mac_address);
                        let text = `<center><b>${processedSettings.companyName || 'TIGA PUTRA MOTOR'}</b></center>\n`;
                        text += `${'--------------------------------'}\n`;
                        text += `No: ${data.transactionNumber}\nTgl: ${new Date(data.date).toLocaleString('id-ID')}\nPlg: ${data.customerName}\n`;
                        text += `${'--------------------------------'}\n`;
                        const all = [...(data.services || []), ...(data.parts || []), ...(data.items || [])];
                        all.forEach(i => { text += `${i.description.toUpperCase()}\n  ${i.quantity} x ${i.unitPrice}\t${i.subtotal}\n`; });
                        text += `${'--------------------------------'}\n`;
                        text += `<B>Total: ${data.total}</B>\n`;
                        if (data.paid !== undefined) text += `Dibayar: ${data.paid}\n`;
                        if (data.paid !== undefined && data.total > data.paid) text += `Sisa: ${data.total - data.paid}\n`;
                        text += `${'--------------------------------'}\n`;
                        text += `<center>${processedSettings.footer || 'Terimakasih'}</center>\n\n\n\n`;
                        await BLEPrinter.printText(text);
                        return;
                    }
                } catch (e) {
                    console.warn('BLE print failed:', e);
                }
            }
            await Print.printAsync({ html, width: paperWidthPoints });
        }
    } catch (error) {
        console.error('Print error:', error);
        throw new Error('Gagal mencetak struk. Cek koneksi QZ Tray di Pengaturan Cetak atau pastikan printer terhubung.');
    }
}

export async function saveReceiptPDF(data: PrintReceiptData, settings: PrintSettings): Promise<void> {
    try {
        const base64Logo = await ensureLogoBase64(settings.logoUri);
        const processedSettings = { ...settings, logoUri: base64Logo };
        const html = generateReceiptHTML(data, processedSettings);
        const paperWidthPoints = settings.paperSize === '80mm' ? 227 : 164;

        if (Platform.OS === 'web') return printHtmlInBrowser(html);

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
