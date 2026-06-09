import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { printHtmlInBrowser } from './printHtmlBrowser';
import { printHtmlViaQz } from './qzTray';

export interface PrintReportConfig {
    title: string;
    subtitle?: string;
    dateRange: string;
    companyName?: string;
    companyAddress?: string;
    companyPhone?: string;
}

/**
 * Generate PDF for any report
 */
export async function printReportHTML(htmlContent: string, config: PrintReportConfig): Promise<void> {
    const fullHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                @page { margin: 20mm; size: A4; }
                * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
                body {
                    font-family: 'Helvetica', 'Arial', sans-serif;
                    color: #333;
                    line-height: 1.5;
                    margin: 0;
                    padding: 0;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 2px solid #023C69;
                    padding-bottom: 20px;
                }
                .company-name {
                    font-size: 24px;
                    font-weight: bold;
                    color: #023C69;
                    margin-bottom: 5px;
                }
                .report-title {
                    font-size: 20px;
                    font-weight: bold;
                    margin-top: 15px;
                    text-transform: uppercase;
                }
                .report-info {
                    font-size: 12px;
                    color: #666;
                    margin-top: 5px;
                }
                .content {
                    width: 100%;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }
                th {
                    background-color: #f8f9fa;
                    color: #023C69;
                    text-align: left;
                    padding: 10px;
                    border-bottom: 2px solid #dee2e6;
                    font-size: 12px;
                }
                td {
                    padding: 10px;
                    border-bottom: 1px solid #dee2e6;
                    font-size: 11px;
                }
                .text-right { text-align: right; }
                .font-bold { font-weight: bold; }
                .bg-light { background-color: #f8f9fa; }
                .text-error { color: #dc3545; }
                .text-success { color: #28a745; }
                .section-header {
                    background-color: #023C69;
                    color: white;
                    padding: 10px;
                    font-weight: bold;
                    margin-top: 20px;
                    margin-bottom: 10px;
                    font-size: 14px;
                    border-radius: 4px;
                }
                .footer {
                    margin-top: 50px;
                    text-align: right;
                    font-size: 10px;
                    color: #999;
                }
                /* Utility classes for rows */
                .row-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
                .row-sub { padding-left: 20px; font-size: 10px; color: #666; }
                .row-total { font-weight: bold; border-top: 1.5px solid #333; margin-top: 10px; padding-top: 10px; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="company-name">${config.companyName || 'TIGA PUTRA MOTOR'}</div>
                <div style="font-size: 12px; color: #666;">
                    ${config.companyAddress || 'Jl. Raya Cianjur Sukabumi KM 5, Cianjur'}<br>
                    HP: ${config.companyPhone || '087720225244'}
                </div>
                <div class="report-title">${config.title}</div>
                <div class="report-info">Periode: ${config.dateRange}</div>
                <div class="report-info">Waktu Cetak: ${new Date().toLocaleString('id-ID')}</div>
                ${config.subtitle ? `<div class="report-info">${config.subtitle}</div>` : ''}
            </div>

            <div class="content">
                ${htmlContent}
            </div>

            <div class="footer">
                Dicetak pada: ${new Date().toLocaleString('id-ID')}
            </div>
        </body>
        </html>
    `;

    try {
        if (Platform.OS === 'web') {
            const printedByQz = await printHtmlViaQz(fullHtml);
            if (!printedByQz) {
                await printHtmlInBrowser(fullHtml);
            }
        } else {
            const { uri } = await Print.printToFileAsync({ html: fullHtml });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: `Laporan ${config.title}`,
                    UTI: 'com.adobe.pdf'
                });
            }
        }
    } catch (error) {
        console.error('Print report error:', error);
        throw new Error('Gagal mencetak laporan. Cek koneksi QZ Tray di Pengaturan Cetak atau pastikan printer terhubung.');
    }
}
