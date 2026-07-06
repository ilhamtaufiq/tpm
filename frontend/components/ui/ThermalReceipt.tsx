import React from 'react';
import { View } from 'react-native';
import { PrintSettings } from '../../utils/printSettings';
import { PrintReceiptData } from '../../utils/printReceipt';
import { ReceiptHtmlPreview } from './ReceiptHtmlPreview';

interface BaseReceiptItem {
    description: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
}

interface ReceiptData {
    type: 'bengkel' | 'jasa_angkut';
    transactionNumber: string;
    antrian?: string | number;
    date: Date;
    customerName: string;
    cashierName?: string;
    mechanicName?: string;
    status?: string;
    items?: BaseReceiptItem[];
    services?: BaseReceiptItem[];
    parts?: BaseReceiptItem[];
    subtotal: number;
    tax?: number;
    discount?: number;
    total: number;
    paid?: number;
    change?: number;
    paymentMethod?: string;
    notes?: string;
    vehiclePlate?: string;
    vehicleType?: string;
}

interface ThermalReceiptProps {
    data: ReceiptData;
    settings: PrintSettings;
}

function toPrintReceiptData(data: ReceiptData): PrintReceiptData {
    return {
        type: data.type,
        transactionNumber: data.transactionNumber,
        antrian: data.antrian,
        date: data.date,
        customerName: data.customerName,
        cashierName: data.cashierName,
        mechanicName: data.mechanicName,
        status: data.status,
        items: data.items,
        services: data.services,
        parts: data.parts,
        subtotal: data.subtotal,
        tax: data.tax,
        discount: data.discount,
        total: data.total,
        paid: data.paid,
        change: data.change,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
        vehiclePlate: data.vehiclePlate,
        vehicleType: data.vehicleType,
        showDiscount: true,
    };
}

export const ThermalReceipt = React.forwardRef<View, ThermalReceiptProps>(({ data, settings }, ref) => {
    return (
        <View ref={ref}>
            <ReceiptHtmlPreview data={toPrintReceiptData(data)} settings={settings} />
        </View>
    );
});

ThermalReceipt.displayName = 'ThermalReceipt';