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

/**
 * Generate URL QR code for online receipt viewing
 */
export function generateReceiptURL(
    baseURL: string,
    transactionNumber: string,
    type: 'bengkel' | 'jasa_angkut'
): string {
    // Example: https://tpm.app/receipt/bengkel/12345
    return `${baseURL}/receipt/${type}/${transactionNumber}`;
}
