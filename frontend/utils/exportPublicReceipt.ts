import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { captureRef } from 'react-native-view-shot';
import { BASE_URL } from './api';
import { useAuthStore } from '../store/useAuthStore';
import {
    ExportPublicReceiptOptions,
    buildPublicReceiptPdfPath,
    sanitizeFileName,
} from './exportPublicReceipt.shared';

export { prepareReceiptCapture, PUBLIC_RECEIPT_CAPTURE_ROOT_ID } from './exportPublicReceipt.shared';

async function captureCardNative(ref: { current: unknown }): Promise<string> {
    if (!ref.current) {
        throw new Error('Kartu struk belum siap untuk diekspor');
    }
    return captureRef(ref, {
        format: 'png',
        quality: 1,
        result: 'data-uri',
    });
}

async function saveNativePdfFromDataUri(dataUri: string, fileName: string): Promise<void> {
    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #f8fafc;
      display: flex;
      justify-content: center;
      padding: 16px;
    }
    img { width: 100%; max-width: 420px; height: auto; display: block; }
  </style>
</head>
<body>
  <img src="${dataUri}" alt="Struk" />
</body>
</html>`;

    const { uri } = await Print.printToFileAsync({ html, width: 420 });
    if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Sharing tidak tersedia di perangkat ini');
    }
    const target = `${FileSystem.cacheDirectory}${fileName}.pdf`;
    await FileSystem.copyAsync({ from: uri, to: target });
    await Sharing.shareAsync(target, {
        mimeType: 'application/pdf',
        dialogTitle: 'Download Struk PDF',
        UTI: 'com.adobe.pdf',
    });
}

async function shareNativePdfFile(uri: string, fileName: string): Promise<void> {
    if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Sharing tidak tersedia di perangkat ini');
    }
    await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Download ${fileName}.pdf`,
        UTI: 'com.adobe.pdf',
    });
}

async function downloadServerPdfNative(options: ExportPublicReceiptOptions): Promise<void> {
    if (!options.receiptId) {
        throw new Error('ID struk tidak valid');
    }

    const path = buildPublicReceiptPdfPath(options.receiptType, options.receiptId);
    const fileName = sanitizeFileName(options.receipt.transactionNumber);
    const target = `${FileSystem.cacheDirectory}${fileName}.pdf`;
    const token = useAuthStore.getState().token;
    const headers: Record<string, string> = {};
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const result = await FileSystem.downloadAsync(`${BASE_URL}${path}`, target, { headers });
    if (result.status < 200 || result.status >= 300) {
        throw new Error(`Gagal mengunduh PDF (status ${result.status})`);
    }

    const info = await FileSystem.getInfoAsync(result.uri);
    if (!info.exists || (info.size != null && info.size < 50)) {
        throw new Error('File PDF kosong dari server');
    }

    await shareNativePdfFile(result.uri, fileName);
}

async function shareNativeImageFromDataUri(dataUri: string): Promise<void> {
    const fileName = `struk_${Date.now()}.png`;
    const target = `${FileSystem.cacheDirectory}${fileName}`;
    const base64 = dataUri.replace(/^data:image\/[a-z]+;base64,/, '');
    await FileSystem.writeAsStringAsync(target, base64, {
        encoding: FileSystem.EncodingType.Base64,
    });
    if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Sharing tidak tersedia di perangkat ini');
    }
    await Sharing.shareAsync(target, {
        mimeType: 'image/png',
        dialogTitle: 'Bagikan Gambar Struk',
        UTI: 'public.png',
    });
}

export async function exportPublicReceiptPdf(options: ExportPublicReceiptOptions): Promise<void> {
    const fileName = sanitizeFileName(options.receipt.transactionNumber);
    try {
        await downloadServerPdfNative(options);
    } catch (serverError) {
        console.warn('[exportPublicReceiptPdf] server PDF failed, fallback to capture:', serverError);
        try {
            const dataUri = await captureCardNative(options.cardRef);
            await saveNativePdfFromDataUri(dataUri, fileName);
        } catch (captureError) {
            console.error('[exportPublicReceiptPdf] capture fallback failed:', captureError);
            const message =
                (serverError as Error)?.message ||
                (captureError as Error)?.message ||
                'Gagal membuat PDF struk';
            throw new Error(message);
        }
    }
}

export async function exportPublicReceiptImage(options: ExportPublicReceiptOptions): Promise<void> {
    const dataUri = await captureCardNative(options.cardRef);
    await shareNativeImageFromDataUri(dataUri);
}
