import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

type XlsxPayload = Blob | ArrayBuffer;

function toBlob(data: XlsxPayload): Blob {
    return data instanceof Blob ? data : new Blob([data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
}

export async function downloadXlsxBlob(data: XlsxPayload, filename: string): Promise<void> {
    const blob = toBlob(data);

    if (Platform.OS === 'web') {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        return;
    }

    const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (typeof result !== 'string') {
                reject(new Error('Gagal membaca file Excel'));
                return;
            }
            const encoded = result.split(',')[1];
            if (!encoded) {
                reject(new Error('Gagal mengonversi file Excel'));
                return;
            }
            resolve(encoded);
        };
        reader.onerror = () => reject(reader.error ?? new Error('Gagal membaca file Excel'));
        reader.readAsDataURL(blob);
    });

    const uri = `${FileSystem.documentDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(uri, base64, {
        encoding: FileSystem.EncodingType.Base64,
    });

    if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: filename,
            UTI: 'com.microsoft.excel.xls',
        });
    }
}