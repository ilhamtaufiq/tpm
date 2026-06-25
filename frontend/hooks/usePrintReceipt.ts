import { useCallback, useState } from 'react';
import { printReceipt, saveReceiptPDF, PrintReceiptData } from '../utils/printReceipt';
import { printSettingsService, PrintSettings } from '../utils/printSettings';

async function getSettings(): Promise<PrintSettings> {
    return printSettingsService.getSettings();
}

export function usePrintReceipt() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handlePrint = useCallback(async (data: PrintReceiptData) => {
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            const settings = await getSettings();
            await printReceipt(data, settings);
            setSuccess('Struk berhasil dicetak.');
        } catch (e: any) {
            setError(e?.message || 'Gagal mencetak struk. Periksa koneksi printer.');
        } finally {
            setLoading(false);
        }
    }, []);

    const handleShare = useCallback(async (data: PrintReceiptData) => {
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            const settings = await getSettings();
            await saveReceiptPDF(data, settings);
            setSuccess('Struk berhasil dibagikan.');
        } catch (e: any) {
            setError(e?.message || 'Gagal membagikan struk.');
        } finally {
            setLoading(false);
        }
    }, []);

    const clearMessages = useCallback(() => {
        setError(null);
        setSuccess(null);
    }, []);

    return { loading, error, success, handlePrint, handleShare, clearMessages };
}
