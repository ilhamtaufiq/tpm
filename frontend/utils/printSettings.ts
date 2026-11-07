import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { ReceiptTemplate } from './receiptTemplates';
import { getPaperDimensions, normalizePaperSize } from './paperSize';
import { normalizeQrCodeBaseUrl } from './publicReceiptUrl';
import { settingsService } from '../services/settings';

export interface PrintSettings {
    header: string;
    footer: string;
    logoUri: string | null;
    paperSize: '58mm' | '80mm';
    printMethod: 'browser' | 'qz';
    webPrinterName: string;
    companyName: string;
    companyAddress: string;
    companyPhone: string;
    template: ReceiptTemplate;
    showQRCode: boolean;
    qrCodeBaseURL: string;
}

const DEFAULT_SETTINGS: PrintSettings = {
    header: 'TPM SUPER APP',
    footer: 'Terima kasih telah menggunakan layanan kami',
    logoUri: 'tpm_default',
    paperSize: '80mm',
    printMethod: Platform.OS === 'web' ? 'qz' : 'browser',
    webPrinterName: '',
    companyName: 'TPM Business',
    companyAddress: 'Jl. Contoh No. 123, Jakarta',
    companyPhone: '(021) 1234-5678',
    template: 'standard',
    showQRCode: true,
    qrCodeBaseURL: ''
};

const STORAGE_KEY = '@print_settings';

// Batas tunggu baca dari server. Lewat dari ini, cache lokal yang dipakai.
const SERVER_READ_TIMEOUT_MS = 3000;
let serverRefresh: Promise<void> | null = null;

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
    new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout membaca pengaturan cetak dari server')), ms);
        promise.then(
            (value) => { clearTimeout(timer); resolve(value); },
            (error) => { clearTimeout(timer); reject(error); },
        );
    });

export const printSettingsService = {
    /**
     * Pengaturan cetak diambil dari server (berlaku untuk semua perangkat), disimpan ke cache
     * lokal, lalu cache dikembalikan. Saat server tidak bisa dihubungi, cache lokal dipakai.
     */
    async getSettings(): Promise<PrintSettings> {
        await this.refreshFromServer();
        return this.getLocalSettings();
    },

    async refreshFromServer(): Promise<void> {
        if (!serverRefresh) {
            serverRefresh = (async () => {
                try {
                    const systemSettings = await withTimeout(settingsService.getSettings(), SERVER_READ_TIMEOUT_MS);
                    const mapped = this.fromSystemSettings(systemSettings);
                    if (Object.keys(mapped).length > 0) {
                        await this.writeLocalSettings(mapped);
                    }
                } catch (error) {
                    console.warn('Pengaturan cetak dari server tidak tersedia, memakai cache lokal:', error);
                } finally {
                    serverRefresh = null;
                }
            })();
        }
        return serverRefresh;
    },

    async getLocalSettings(): Promise<PrintSettings> {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEY);
            if (data) {
                const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(data) } as PrintSettings;
                if (
                    Platform.OS === 'web'
                    && parsed.webPrinterName
                    && parsed.printMethod === 'browser'
                ) {
                    parsed.printMethod = 'qz';
                }
                parsed.paperSize = getPaperDimensions(parsed.paperSize).paperSize;
                parsed.qrCodeBaseURL = normalizeQrCodeBaseUrl(parsed.qrCodeBaseURL);
                return parsed;
            }
            return DEFAULT_SETTINGS;
        } catch (error) {
            console.error('Error loading print settings:', error);
            return DEFAULT_SETTINGS;
        }
    },

    async writeLocalSettings(settings: Partial<PrintSettings>): Promise<void> {
        const current = await this.getLocalSettings();
        const updated = { ...current, ...settings };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    },

    /** Simpan hanya ke perangkat ini. Sinkronisasi ke server dilakukan pemanggil (khusus admin). */
    async saveSettings(settings: Partial<PrintSettings>): Promise<void> {
        try {
            await this.writeLocalSettings(settings);
        } catch (error) {
            console.error('Error saving print settings:', error);
            throw error;
        }
    },

    async resetSettings(): Promise<void> {
        try {
            await AsyncStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            console.error('Error resetting print settings:', error);
            throw error;
        }
    },

    /**
     * Helper to map backend settings to frontend settings
     */
    fromSystemSettings(systemSettings: any): Partial<PrintSettings> {
        if (!systemSettings || !systemSettings.print) return {};
        const p = systemSettings.print;
        return {
            companyName: p.company_name,
            companyAddress: p.company_address,
            companyPhone: p.company_phone,
            header: p.header,
            footer: p.footer,
            logoUri: p.logo_uri,
            showQRCode: p.show_qr_code !== undefined ? p.show_qr_code : true,
            paperSize: normalizePaperSize(p.paper_size),
            printMethod: p.print_method || 'browser'
        };
    }
};
