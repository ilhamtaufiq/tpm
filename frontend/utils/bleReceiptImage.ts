import * as FileSystem from 'expo-file-system';
import { getBleRasterSpec } from './paperSize';

/** Soft cap for JPEG file written before BLE print (bytes). */
const MAX_BLE_IMAGE_FILE_BYTES = 1_500_000;

export function normalizeBleImageUri(uri: string): string {
    if (!uri) return uri;
    if (uri.startsWith('file://') || uri.startsWith('data:')) {
        return uri;
    }
    if (uri.startsWith('/')) {
        return `file://${uri}`;
    }
    return uri;
}

export async function buildBleImagePayload(
    imageUri: string,
    paperSize?: string | null,
): Promise<string> {
    const raster = getBleRasterSpec(paperSize);
    const normalized = normalizeBleImageUri(imageUri);
    const info = await FileSystem.getInfoAsync(normalized);

    if (!info.exists) {
        throw new Error('Gambar struk tidak ditemukan setelah render. Tutup aplikasi lalu coba cetak lagi.');
    }

    const size = 'size' in info ? Number(info.size) : 0;
    if (!size || size < 64) {
        throw new Error('Gambar struk kosong atau rusak setelah render.');
    }

    if (size > MAX_BLE_IMAGE_FILE_BYTES) {
        throw new Error(
            `Gambar struk terlalu besar (${Math.round(size / 1024)} KB) untuk kertas ${raster.paperSize}. Kurangi item atau gunakan kertas yang sesuai.`,
        );
    }

    return JSON.stringify({
        url: normalized,
        maxWidth: raster.targetWidthPx,
        maxHeight: raster.maxHeightPx,
        paperSize: raster.paperSize,
    });
}