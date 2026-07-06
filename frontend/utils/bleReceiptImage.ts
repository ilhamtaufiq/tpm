import * as FileSystem from 'expo-file-system';

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

export async function buildBleImagePayload(imageUri: string, maxWidth: number): Promise<string> {
    const normalized = normalizeBleImageUri(imageUri);
    const info = await FileSystem.getInfoAsync(normalized);

    if (!info.exists) {
        throw new Error('Gambar struk tidak ditemukan setelah render. Tutup aplikasi lalu coba cetak lagi.');
    }

    const size = 'size' in info ? Number(info.size) : 0;
    if (!size || size < 64) {
        throw new Error('Gambar struk kosong atau rusak setelah render.');
    }

    return JSON.stringify({
        url: normalized,
        maxWidth,
    });
}