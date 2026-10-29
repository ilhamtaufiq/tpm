import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { BASE_URL } from './dataImport';
import { useAuthStore } from '../store/useAuthStore';

// Faktur penjualan mobil (PDF A4 dengan kotak materai). Di web dibuka di tab baru,
// di native diunduh lalu dibagikan (cetak, simpan, atau kirim).
export const unduhFakturMobil = async (transaksiId: number, nomorTransaksi: string): Promise<void> => {
    const token = useAuthStore.getState().token;
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const url = `${BASE_URL}/penjualan-mobil/${transaksiId}/faktur.pdf`;

    if (Platform.OS === 'web') {
        const respon = await fetch(url, { headers });
        if (!respon.ok) throw new Error('Faktur tidak bisa dibuat');
        const blob = await respon.blob();
        window.open(URL.createObjectURL(blob), '_blank');
        return;
    }

    const fileUri = `${FileSystem.cacheDirectory}faktur-${nomorTransaksi}.pdf`;
    const hasil = await FileSystem.downloadAsync(url, fileUri, { headers });
    if (hasil.status !== 200) throw new Error('Faktur tidak bisa dibuat');
    if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(hasil.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    }
};
