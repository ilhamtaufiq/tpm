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
    quantity?: number;
    unitPrice?: number;
    subtotal: number;
}

interface ReceiptData {
    type: 'bengkel' | 'jasa_angkut';
    transactionNumber: string;
    date: Date;
    customerName: string;
    items: BaseReceiptItem[];
    subtotal: number;
    tax?: number;
    discount?: number;
    total: number;
    paid?: number;
    change?: number;
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
                <Text style={styles.companyName}>{settings.companyName}</Text>
                {settings.header && <Text style={styles.headerText}>{settings.header}</Text>}
                <Text style={styles.companyInfo}>{settings.companyAddress}</Text>
                <Text style={styles.companyInfo}>{settings.companyPhone}</Text>
            </View>

            <View style={styles.divider} />

            {/* Transaction Info */}
            <View style={styles.section}>
                <View style={styles.row}>
                    <Text style={styles.label}>No. Transaksi</Text>
                    <Text style={styles.value}>{data.transactionNumber}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Tanggal</Text>
                    <Text style={styles.value}>{formatDate(data.date.toISOString())}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Jam</Text>
                    <Text style={styles.value}>{formatTime(data.date)}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Customer</Text>
                    <Text style={styles.value}>{data.customerName}</Text>
                </View>

                {/* Type specific info */}
                {data.type === 'bengkel' && data.vehiclePlate && (
                    <>
                        <View style={styles.row}>
                            <Text style={styles.label}>No. Polisi</Text>
                            <Text style={styles.value}>{data.vehiclePlate}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Jenis Kendaraan</Text>
                            <Text style={styles.value}>{data.vehicleType}</Text>
                        </View>
                    </>
                )}

                {data.type === 'jasa_angkut' && data.origin && (
                    <>
                        <View style={styles.row}>
                            <Text style={styles.label}>Rute</Text>
                            <Text style={styles.value}>{data.origin} → {data.destination}</Text>
                        </View>
                        {data.driverName && (
                            <View style={styles.row}>
                                <Text style={styles.label}>Supir</Text>
                                <Text style={styles.value}>{data.driverName}</Text>
                            </View>
                        )}
                    </>
                )}
            </View>

            <View style={styles.divider} />

            {/* Items */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>RINCIAN</Text>
                {data.items.map((item, index) => (
                    <View key={index} style={styles.itemRow}>
                        <View style={styles.itemDescription}>
                            <Text style={styles.itemName}>{item.description}</Text>
                            {item.quantity && item.unitPrice && (
                                <Text style={styles.itemDetails}>
                                    {item.quantity} x {formatCurrency(item.unitPrice)}
                                </Text>
                            )}
                        </View>
                        <Text style={styles.itemPrice}>{formatCurrency(item.subtotal)}</Text>
                    </View>
                ))}
            </View>

            <View style={styles.divider} />

            {/* Totals */}
            <View style={styles.section}>
                <View style={styles.row}>
                    <Text style={styles.label}>Subtotal</Text>
                    <Text style={styles.value}>{formatCurrency(data.subtotal)}</Text>
                </View>

                {data.tax && data.tax > 0 && (
                    <View style={styles.row}>
                        <Text style={styles.label}>Pajak</Text>
                        <Text style={styles.value}>{formatCurrency(data.tax)}</Text>
                    </View>
                )}

                {data.discount && data.discount > 0 && (
                    <View style={styles.row}>
                        <Text style={styles.label}>Diskon</Text>
                        <Text style={styles.value}>-{formatCurrency(data.discount)}</Text>
                    </View>
                )}

                <View style={[styles.row, styles.totalRow]}>
                    <Text style={styles.totalLabel}>TOTAL</Text>
                    <Text style={styles.totalValue}>{formatCurrency(data.total)}</Text>
                </View>

                {data.paymentMethod && (
                    <View style={styles.row}>
                        <Text style={styles.label}>Metode Bayar</Text>
                        <Text style={styles.value}>{data.paymentMethod.toUpperCase()}</Text>
                    </View>
                )}

                {data.paid && data.paid > 0 && (
                    <>
                        <View style={styles.row}>
                            <Text style={styles.label}>Dibayar</Text>
                            <Text style={styles.value}>{formatCurrency(data.paid)}</Text>
                        </View>
                        {data.change && data.change > 0 && (
                            <View style={styles.row}>
                                <Text style={styles.label}>Kembalian</Text>
                                <Text style={styles.value}>{formatCurrency(data.change)}</Text>
                            </View>
                        )}
                    </>
                )}
            </View>

            {data.notes && (
                <>
                    <View style={styles.divider} />
                    <View style={styles.section}>
                        <Text style={styles.label}>Catatan:</Text>
                        <Text style={styles.notes}>{data.notes}</Text>
                    </View>
                </>
            )}

            {/* Footer */}
            <View style={styles.divider} />
            <View style={styles.footer}>
                {settings.footer && <Text style={styles.footerText}>{settings.footer}</Text>}
                <Text style={styles.footerInfo}>Struk ini dicetak otomatis</Text>
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
