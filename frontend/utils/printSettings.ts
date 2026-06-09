import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReceiptTemplate } from './receiptTemplates';

export interface PrintSettings {
    header: string;
    footer: string;
    logoUri: string | null;
    paperSize: '58mm' | '80mm';
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
    webPrinterName: '',
    companyName: 'TPM Business',
    companyAddress: 'Jl. Contoh No. 123, Jakarta',
    companyPhone: '(021) 1234-5678',
    template: 'standard',
    showQRCode: true,
    qrCodeBaseURL: 'https://tpm.app'
};

const STORAGE_KEY = '@print_settings';

export const printSettingsService = {
    async getSettings(): Promise<PrintSettings> {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEY);
            if (data) {
                return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
            }
            return DEFAULT_SETTINGS;
        } catch (error) {
            console.error('Error loading print settings:', error);
            return DEFAULT_SETTINGS;
        }
    },

    async saveSettings(settings: Partial<PrintSettings>): Promise<void> {
        try {
            const current = await this.getSettings();
            const updated = { ...current, ...settings };
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
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
            paperSize: p.paper_size || '80mm'
        };
    }
};
