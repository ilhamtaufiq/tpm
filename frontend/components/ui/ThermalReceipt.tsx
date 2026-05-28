import React, { useRef } from 'react';
import { View, Text, StyleSheet, Platform, Image } from 'react-native';
import { PrintSettings } from '../../utils/printSettings';
import { formatCurrency, formatDate } from '../../utils/format';

// For web/desktop printing
declare global {
    interface Window {
        __printReceipt?: (html: string) => void;
    }
}

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
    items?: BaseReceiptItem[]; // For backward compatibility
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

export const ThermalReceipt = React.forwardRef<View, ThermalReceiptProps>(({ data, settings }, ref) => {
    const paperWidth = settings.paperSize === '80mm' ? 302 : 220; // pixels for 80mm and 58mm at 96dpi
    const styles = createStyles(paperWidth);

    return (
        <View ref={ref} style={styles.receipt}>
            {/* Header */}
            <View style={styles.header}>
                {settings.logoUri && (
                    <Image source={{ uri: settings.logoUri }} style={styles.logo} resizeMode="contain" />
                )}
                <Text style={[styles.companyName, { fontFamily: 'monospace' }]}>{settings.companyName || 'TIGA PUTRA MOTOR'}</Text>
                <Text style={[styles.companyInfo, { color: '#000', fontFamily: 'monospace' }]}>{settings.companyAddress || 'jl.raya cianjur sukabumi km 5 ciwalen'}</Text>
                <Text style={[styles.companyInfo, { color: '#000', fontFamily: 'monospace' }]}>cianjur   HP {settings.companyPhone || '087720225244'}</Text>
            </View>

            <View style={styles.divider} />

            {/* Transaction Info */}
            <View style={styles.section}>
                {[
                    { label: 'No Nota', value: data.transactionNumber },
                    { label: 'Antrian', value: data.antrian },
                    { label: 'Pelanggan', value: data.customerName },
                    { label: 'Tanggal', value: formatDate(data.date.toISOString()) + ' - ' + formatTime(data.date).substring(0, 5) },
                    { label: 'Kasir', value: data.cashierName },
                    { label: 'Mekanik', value: data.mechanicName },
                ].map((row, i) => row.value ? (
                    <View key={i} style={styles.row}>
                        <Text style={[styles.label, { fontFamily: 'monospace', color: '#000' }]}>{row.label}</Text>
                        <Text style={[styles.value, { fontFamily: 'monospace', color: '#000' }]}>{row.value}</Text>
                    </View>
                ) : null)}
            </View>

            <View style={styles.divider} />

            {/* Layanan Section */}
            {(data.services || (data.type === 'bengkel' ? [] : data.items || [])).length > 0 && (
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { textAlign: 'center', fontFamily: 'monospace' }]}>LAYANAN</Text>
                    {(data.services || (data.type === 'bengkel' ? [] : data.items || [])).map((item, index) => (
                        <View key={index} style={{ marginBottom: 6 }}>
                            <Text style={[styles.itemName, { fontFamily: 'monospace', textTransform: 'uppercase' }]}>{item.description}</Text>
                            <View style={styles.row}>
                                <Text style={[styles.itemDetails, { fontFamily: 'monospace', color: '#000' }]}>
                                    {item.quantity} x {formatCurrency(item.unitPrice).replace('Rp', '').trim()}
                                </Text>
                                <Text style={[styles.itemPrice, { fontFamily: 'monospace' }]}>
                                    {formatCurrency(item.subtotal).replace('Rp', '').trim()}
                                </Text>
                            </View>
                        </View>
                    ))}
                    <View style={[styles.divider, { marginVertical: 4 }]} />
                    <View style={styles.row}>
                        <Text style={[styles.label, { fontFamily: 'monospace', color: '#000' }]}>Total</Text>
                        <Text style={[styles.value, { fontFamily: 'monospace', color: '#000', fontWeight: 'bold' }]}>
                            {formatCurrency((data.services || (data.type === 'bengkel' ? [] : data.items || [])).reduce((acc, c) => acc + c.subtotal, 0)).replace('Rp', '').trim()}
                        </Text>
                    </View>
                </View>
            )}

            {/* Spare Part Section */}
            {(data.parts || []).length > 0 && (
                <View style={styles.section}>
                    <View style={styles.divider} />
                    <Text style={[styles.sectionTitle, { textAlign: 'center', fontFamily: 'monospace' }]}>SPARE PART</Text>
                    {(data.parts || []).map((item, index) => (
                        <View key={index} style={{ marginBottom: 6 }}>
                            <Text style={[styles.itemName, { fontFamily: 'monospace', textTransform: 'uppercase' }]}>{item.description}</Text>
                            <View style={styles.row}>
                                <Text style={[styles.itemDetails, { fontFamily: 'monospace', color: '#000' }]}>
                                    {item.quantity} x {formatCurrency(item.unitPrice).replace('Rp', '').trim()}
                                </Text>
                                <Text style={[styles.itemPrice, { fontFamily: 'monospace' }]}>
                                    {formatCurrency(item.subtotal).replace('Rp', '').trim()}
                                </Text>
                            </View>
                        </View>
                    ))}
                    <View style={[styles.divider, { marginVertical: 4 }]} />
                    <View style={styles.row}>
                        <Text style={[styles.label, { fontFamily: 'monospace', color: '#000' }]}>Total</Text>
                        <Text style={[styles.value, { fontFamily: 'monospace', color: '#000', fontWeight: 'bold' }]}>
                            {formatCurrency((data.parts || []).reduce((acc, c) => acc + c.subtotal, 0)).replace('Rp', '').trim()}
                        </Text>
                    </View>
                </View>
            )}

            <View style={styles.divider} />

            {/* Totals / Summary */}
            <View style={styles.section}>
                {[
                    { label: 'Status', value: data.status },
                    { label: 'Metode Bayar', value: data.paymentMethod },
                    { label: 'SubTotal', value: formatCurrency(data.subtotal).replace('Rp', '').trim() },
                    { label: 'Diskon', value: data.discount ? formatCurrency(data.discount).replace('Rp', '').trim() : null },
                ].map((row, i) => row.value ? (
                    <View key={i} style={styles.row}>
                        <Text style={[styles.label, { fontFamily: 'monospace', color: '#000' }]}>{row.label}</Text>
                        <Text style={[styles.value, { fontFamily: 'monospace', color: '#000' }]}>{row.value}</Text>
                    </View>
                ) : null)}

                <View style={[styles.row, styles.totalRow, { borderTopColor: '#000' }]}>
                    <Text style={[styles.totalLabel, { fontFamily: 'monospace' }]}>Total</Text>
                    <Text style={[styles.totalValue, { fontFamily: 'monospace' }]}>{formatCurrency(data.total).replace('Rp', '').trim()}</Text>
                </View>

                {data.paid !== undefined ? (
                    <View style={[styles.row, { marginTop: 4 }]}>
                        <Text style={[styles.label, { fontFamily: 'monospace', color: '#000' }]}>Dibayar</Text>
                        <Text style={[styles.value, { fontFamily: 'monospace', color: '#000' }]}>
                            {formatCurrency(data.paid).replace('Rp', '').trim()}
                        </Text>
                    </View>
                ) : null}

                {data.paid !== undefined && data.total > data.paid ? (
                    <View style={styles.row}>
                        <Text style={[styles.label, { fontFamily: 'monospace', color: '#000', fontWeight: 'bold' }]}>Sisa (Piutang)</Text>
                        <Text style={[styles.value, { fontFamily: 'monospace', color: '#000', fontWeight: 'bold' }]}>
                            {formatCurrency(data.total - data.paid).replace('Rp', '').trim()}
                        </Text>
                    </View>
                ) : null}

                {data.change !== undefined && data.change > 0 ? (
                    <View style={styles.row}>
                        <Text style={[styles.label, { fontFamily: 'monospace', color: '#000' }]}>Kembalian</Text>
                        <Text style={[styles.value, { fontFamily: 'monospace', color: '#000' }]}>
                            {formatCurrency(data.change).replace('Rp', '').trim()}
                        </Text>
                    </View>
                ) : null}
            </View>

            <View style={styles.divider} />

            {data.vehiclePlate ? (
                <View style={styles.section}>
                    <Text style={[styles.value, { fontFamily: 'monospace', textAlign: 'left', maxWidth: '100%' }]}>{data.vehiclePlate}</Text>
                    <View style={[styles.divider, { marginVertical: 4 }]} />
                </View>
            ) : null}

            {/* Footer */}
            <View style={styles.footer}>
                <Text style={[styles.footerText, { fontFamily: 'monospace' }]}>{settings.footer || 'Terimakasih atas kepercayaan anda'}</Text>
            </View>
        </View>
    );
});

ThermalReceipt.displayName = 'ThermalReceipt';

const createStyles = (paperWidth: number) => StyleSheet.create({
    receipt: {
        width: paperWidth,
        backgroundColor: '#ffffff',
        padding: 12,
        fontFamily: 'monospace'
    },
    header: {
        alignItems: 'center',
        marginBottom: 8
    },
    logo: {
        width: 80,
        height: 80,
        marginBottom: 8
    },
    companyName: {
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 4
    },
    headerText: {
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 4
    },
    companyInfo: {
        fontSize: 10,
        textAlign: 'center',
        color: '#666',
        marginBottom: 2
    },
    divider: {
        borderBottomWidth: 1,
        borderBottomColor: '#000',
        borderStyle: 'dashed',
        marginVertical: 8
    },
    section: {
        marginBottom: 4
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        marginBottom: 6
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4
    },
    label: {
        fontSize: 10,
        color: '#333'
    },
    value: {
        fontSize: 10,
        fontWeight: '500',
        textAlign: 'right',
        maxWidth: '60%'
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6
    },
    itemDescription: {
        flex: 1,
        marginRight: 8
    },
    itemName: {
        fontSize: 10,
        fontWeight: '500',
        marginBottom: 2
    },
    itemDetails: {
        fontSize: 9,
        color: '#666'
    },
    itemPrice: {
        fontSize: 10,
        fontWeight: '600',
        textAlign: 'right'
    },
    totalRow: {
        marginTop: 4,
        paddingTop: 4,
        borderTopWidth: 1,
        borderTopColor: '#000'
    },
    totalLabel: {
        fontSize: 12,
        fontWeight: 'bold'
    },
    totalValue: {
        fontSize: 12,
        fontWeight: 'bold'
    },
    notes: {
        fontSize: 9,
        fontStyle: 'italic',
        color: '#666',
        marginTop: 2
    },
    footer: {
        alignItems: 'center',
        marginTop: 4
    },
    footerText: {
        fontSize: 10,
        textAlign: 'center',
        marginBottom: 4
    },
    footerInfo: {
        fontSize: 8,
        color: '#999',
        textAlign: 'center'
    }
});

// Format time helper
function formatTime(date: Date): string {
    return date.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}
