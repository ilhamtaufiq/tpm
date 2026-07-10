import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { PrintReceiptData } from '../../utils/printReceipt';
import { PrintSettings } from '../../utils/printSettings';
import { buildReceiptDocument } from '../../utils/receiptDocument';
import { getPaperDimensions } from '../../utils/paperSize';
import { formatReceiptCurrency } from '../../utils/receiptFormatters';

const MONO = Platform.select({
    ios: 'Courier',
    android: 'monospace',
    default: 'monospace',
});

export interface ThermalReceiptViewProps {
    data: PrintReceiptData;
    settings: PrintSettings;
    qrImageDataUrl?: string | null;
    onLayoutHeight?: (height: number) => void;
}

function Divider() {
    return <View style={styles.divider} />;
}

function ReceiptRow({
    label,
    value,
    bold,
    fontSize,
    valueColor,
}: {
    label: string;
    value: string;
    bold?: boolean;
    fontSize: number;
    valueColor?: string;
}) {
    return (
        <View style={styles.row}>
            <Text style={[styles.cell, { fontSize }]}>{label}</Text>
            <Text
                style={[
                    styles.cellRight,
                    { fontSize },
                    bold && styles.bold,
                    valueColor ? { color: valueColor } : null,
                ]}
            >
                {value}
            </Text>
        </View>
    );
}

export const ThermalReceiptView = React.forwardRef<View, ThermalReceiptViewProps>(
    ({ data, settings, qrImageDataUrl, onLayoutHeight }, ref) => {
        const paper = getPaperDimensions(settings.paperSize);
        const doc = useMemo(() => buildReceiptDocument(data, settings), [data, settings]);
        const is80mm = paper.paperSize === '80mm';
        const fsB = paper.fontBase;
        const fsS = paper.fontSmall;
        const fsTitle = paper.fontTitle;
        const fsFooter = paper.fontFooter;
        const fsTotal = is80mm ? 14 : 12;
        const padH = is80mm ? 14 : 8;
        const logoUri = settings.logoUri;

        return (
            <View
                ref={ref}
                collapsable={false}
                onLayout={(event) => onLayoutHeight?.(event.nativeEvent.layout.height)}
                style={[
                    styles.root,
                    {
                        width: paper.widthPx,
                        minHeight: 320,
                        paddingHorizontal: padH,
                        paddingVertical: 8,
                    },
                ]}
            >
                <View style={styles.center}>
                    {logoUri ? (
                        <Image
                            source={{ uri: logoUri }}
                            style={{ width: paper.logoMaxPx, height: paper.logoMaxPx, marginBottom: 6 }}
                            resizeMode="contain"
                        />
                    ) : (
                        <Image
                            source={require('../../assets/logo_tpm.png')}
                            style={{ width: paper.logoMaxPx, height: paper.logoMaxPx, marginBottom: 6 }}
                            resizeMode="contain"
                        />
                    )}
                    <Text style={[styles.centerText, styles.bold, { fontSize: fsTitle }]}>{doc.companyName}</Text>
                    {doc.headerText ? (
                        <Text style={[styles.centerText, { fontSize: fsS }]}>{doc.headerText}</Text>
                    ) : null}
                    {doc.address ? (
                        <Text style={[styles.centerText, { fontSize: fsS }]}>{doc.address}</Text>
                    ) : null}
                    {doc.phone ? (
                        <Text style={[styles.centerText, { fontSize: fsS }]}>Telp: {doc.phone}</Text>
                    ) : null}
                </View>

                <Divider />

                {doc.infoRows.map((row) => (
                    <ReceiptRow key={`${row.label}-${row.value}`} label={row.label} value={row.value} fontSize={fsB} />
                ))}

                <Divider />

                {doc.sections.map((section, sectionIndex) => (
                    <View key={section.title}>
                        {sectionIndex > 0 ? <Divider /> : null}
                        <Text style={[styles.sectionTitle, { fontSize: fsB }]}>
                            {`--- ${section.title.toUpperCase()} ---`}
                        </Text>
                        {section.items.map((item, itemIndex) => (
                            <View key={`${section.title}-${itemIndex}`} style={styles.itemBlock}>
                                <Text style={[styles.bold, { fontSize: fsB }]}>
                                    {String(item.description || '-').toUpperCase()}
                                </Text>
                                <View style={styles.row}>
                                    <Text style={{ fontSize: fsB, fontFamily: MONO }}>
                                        {item.quantity} x {formatReceiptCurrency(item.unitPrice)}
                                    </Text>
                                    <Text style={[styles.cellRight, { fontSize: fsB }]}>
                                        {formatReceiptCurrency(item.subtotal)}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                ))}

                <Divider />

                <ReceiptRow label="SUBTOTAL" value={doc.subtotal} bold fontSize={fsB} />
                {doc.discount ? (
                    <ReceiptRow label="Diskon" value={`-${doc.discount}`} fontSize={fsB} />
                ) : null}
                <ReceiptRow label="TOTAL" value={doc.total} bold fontSize={fsTotal} />
                {doc.paid ? <ReceiptRow label="Dibayar" value={doc.paid} fontSize={fsB} /> : null}
                {doc.sisa ? (
                    <ReceiptRow label="SISA" value={doc.sisa} bold fontSize={fsB} valueColor="#EF4444" />
                ) : (
                    <Text style={[styles.centerText, styles.bold, { fontSize: fsB, paddingTop: 4 }]}>LUNAS</Text>
                )}
                {doc.change ? <ReceiptRow label="Kembalian" value={doc.change} fontSize={fsB} /> : null}
                {doc.paymentMethod ? (
                    <ReceiptRow label="Metode Bayar:" value={doc.paymentMethod} fontSize={fsS} />
                ) : null}

                {doc.notes ? (
                    <>
                        <Divider />
                        <Text style={[{ fontSize: fsS, color: '#000000', fontFamily: MONO }]}>
                            Catatan: {doc.notes}
                        </Text>
                    </>
                ) : null}

                <Divider />

                {doc.showQr && qrImageDataUrl ? (
                    <View style={styles.center}>
                        <Image
                            source={{ uri: qrImageDataUrl }}
                            style={{ width: paper.qrSizePx, height: paper.qrSizePx, marginTop: 4 }}
                            resizeMode="contain"
                        />
                        <Text style={[styles.centerText, { fontSize: fsS, marginTop: 4 }]}>{doc.qrCaption}</Text>
                    </View>
                ) : null}

                <Text style={[styles.centerText, { fontSize: fsFooter, marginTop: doc.showQr && qrImageDataUrl ? 6 : 0 }]}>
                    {doc.footer}
                </Text>
            </View>
        );
    },
);

ThermalReceiptView.displayName = 'ThermalReceiptView';

const styles = StyleSheet.create({
    root: {
        backgroundColor: '#ffffff',
    },
    center: {
        alignItems: 'center',
    },
    centerText: {
        textAlign: 'center',
        color: '#000000',
        fontFamily: MONO,
    },
    bold: {
        fontWeight: '700',
    },
    divider: {
        borderTopWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#000000',
        marginVertical: 4,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: 1,
    },
    cell: {
        flexShrink: 0,
        color: '#000000',
        fontFamily: MONO,
    },
    cellRight: {
        flex: 1,
        textAlign: 'right',
        color: '#000000',
        fontFamily: MONO,
    },
    sectionTitle: {
        textAlign: 'center',
        fontWeight: '700',
        paddingVertical: 2,
        color: '#000000',
        fontFamily: MONO,
    },
    itemBlock: {
        marginBottom: 2,
    },
});