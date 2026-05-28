import api from '../utils/api';

interface Receipt {
    transactionNumber: string;
    date: string;
    customerName: string;
    companyName?: string;
    companyAddress?: string;
    companyPhone?: string;
    items: Array<{
        description: string;
        quantity?: number;
        unitPrice?: number;
        subtotal: number;
    }>;
    subtotal: number;
    tax?: number;
    discount?: number;
    total: number;
    paymentMethod?: string;
    notes?: string;
    // Bengkel specific
    vehiclePlate?: string;
    vehicleType?: string;
    // Jasa Angkut specific
    origin?: string;
    destination?: string;
    driverName?: string;
}

class PrintReceiptService {
    /**
     * Get receipt data by transaction number
     * This endpoint should be publicly accessible for QR code scanning
     */
    async getReceipt(type: 'bengkel' | 'jasa_angkut', transactionId: string): Promise<Receipt> {
        try {
            const response = await api.get(`/public/receipt/${type}/${transactionId}`);
            return response.data;
        } catch (error) {
            console.error('Failed to fetch receipt:', error);
            throw new Error('Gagal memuat struk');
        }
    }

    /**
     * Get receipt PDF URL
     */
    getReceiptPDFUrl(type: 'bengkel' | 'jasa_angkut', transactionId: string): string {
        const baseURL = api.defaults.baseURL || 'http://localhost:8000';
        return `${baseURL}/public/receipt/${type}/${transactionId}/pdf`;
    }

    /**
     * Get receipt share URL
     */
    getReceiptShareUrl(type: 'bengkel' | 'jasa_angkut', transactionId: string): string {
        // For web deployment
        const appURL = 'https://tpm.app'; // Replace with your actual domain
        return `${appURL}/receipt/${type}/${transactionId}`;
    }
}

export const printReceiptService = new PrintReceiptService();
