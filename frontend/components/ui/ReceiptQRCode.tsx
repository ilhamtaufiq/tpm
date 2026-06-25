import React from 'react';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

interface ReceiptQRCodeProps {
    value: string;
    size?: number;
}

/**
 * QR Code component for receipts
 * Generates QR code containing transaction reference or URL
 */
export const ReceiptQRCode: React.FC<ReceiptQRCodeProps> = ({
    value,
    size = 80
}) => {
    return (
        <View style={{ alignItems: 'center', marginVertical: 8 }}>
            <QRCode
                value={value}
                size={size}
                backgroundColor="white"
                color="black"
            />
        </View>
    );
};

/**
 * Generate QR code data for transaction
 */
export function generateTransactionQRData(
    transactionNumber: string,
    type: 'bengkel' | 'jasa_angkut',
    total: number
): string {
    // Format: TYPE-TXNUMBER-TOTAL
    // Example: BENGKEL-12345-150000
    // This can be scanned to verify transaction or link to web portal
    return `${type.toUpperCase()}-${transactionNumber}-${total}`;
}

export { buildPublicReceiptUrl as generateReceiptURL } from '../../utils/publicReceiptUrl';
