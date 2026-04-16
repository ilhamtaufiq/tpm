import React, { useState } from 'react';
import { View, ScrollView, Modal, Pressable, Platform, Image } from 'react-native';
import { X, Printer, Download, ZoomIn, ZoomOut } from 'lucide-react-native';
import { Typography } from './Typography';
import { Button } from './Button';
import { PrintReceiptData } from '../../utils/printReceipt';
import { PrintSettings } from '../../utils/printSettings';

interface ReceiptPreviewProps {
    visible: boolean;
    onClose: () => void;
    onPrint: () => void;
    onSavePDF: () => void;
    data: PrintReceiptData;
    settings: PrintSettings;
    loading?: boolean;
}

export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({
    visible,
    onClose,
    onPrint,
    onSavePDF,
    data,
    settings,
    loading = false
}) => {
    const [zoom, setZoom] = useState(1);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const paperWidth = settings.paperSize === '80mm' ? 302 : 220;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/80">
                {/* Header */}
                <View className="bg-surface px-6 py-4 flex-row items-center justify-between border-b border-gray-200">
                    <Typography variant="h3" weight="bold">Preview Struk</Typography>
                    <View className="flex-row items-center" style={{ gap: 12 }}>
                        <Pressable
                            onPress={() => setZoom(Math.max(0.5, zoom - 0.25))}
                            className="w-10 h-10 bg-gray-100 rounded-xl items-center justify-center"
                        >
                            <ZoomOut size={20} color="#374151" />
                        </Pressable>
                        <Typography variant="caption" weight="medium" className="text-textGray">
                            {Math.round(zoom * 100)}%
                        </Typography>
                        <Pressable
                            onPress={() => setZoom(Math.min(2, zoom + 0.25))}
                            className="w-10 h-10 bg-gray-100 rounded-xl items-center justify-center"
                        >
                            <ZoomIn size={20} color="#374151" />
                        </Pressable>
                        <Pressable
                            onPress={onClose}
                            className="w-10 h-10 bg-gray-100 rounded-xl items-center justify-center ml-2"
                        >
                            <X size={20} color="#374151" />
                        </Pressable>
                    </View>
                </View>

                {/* Receipt Preview */}
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{
                        padding: 24,
                        alignItems: 'center'
                    }}
                    showsVerticalScrollIndicator={false}
                >
                    <View
                        style={{
                            width: paperWidth * zoom,
                            backgroundColor: '#ffffff',
                            padding: 12 * zoom,
                            borderRadius: 8,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 8
                        }}
                    >
                        {/* Header */}
                        <View style={{ alignItems: 'center', marginBottom: 8 * zoom }}>
                            {settings.logoUri ? (
                                <Image 
                                    source={settings.logoUri === 'tpm_default' 
                                        ? require('../../assets/logo_tpm.png') 
                                        : { uri: settings.logoUri }} 
                                    style={{ width: 60 * zoom, height: 60 * zoom, marginBottom: 4 * zoom }} 
                                    resizeMode="contain" 
                                />
                            ) : null}
                            <Typography style={{ fontSize: 16 * zoom, fontWeight: 'bold', textAlign: 'center', marginBottom: 2 * zoom, fontFamily: 'monospace' }}>
                                {settings.companyName || 'TIGA PUTRA MOTOR'}
                            </Typography>
                            <Typography style={{ fontSize: 10 * zoom, textAlign: 'center', color: '#000', marginBottom: 2 * zoom, fontFamily: 'monospace' }}>
                                {settings.companyAddress || 'jl.raya cianjur sukabumi km 5 ciwalen'}
                            </Typography>
                            <Typography style={{ fontSize: 10 * zoom, textAlign: 'center', color: '#000', fontFamily: 'monospace' }}>
                                cianjur &nbsp; HP {settings.companyPhone || '087720225244'}
                            </Typography>
                        </View>

                        {/* Divider */}
                        <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', borderStyle: 'dashed', marginVertical: 8 * zoom }} />

                        {/* Transaction Info */}
                        <View style={{ marginBottom: 4 * zoom }}>
                            {[
                                { label: 'No Nota', value: data.transactionNumber },
                                { label: 'Antrian', value: data.antrian },
                                { label: 'Pelanggan', value: data.customerName },
                                { label: 'Tanggal', value: formatDate(data.date) + ' - ' + formatTime(data.date).substring(0, 5) },
                                { label: 'Kasir', value: data.cashierName },
                                { label: 'Mekanik', value: data.mechanicName },
                            ].map((row, i) => row.value ? (
                                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 * zoom }}>
                                    <Typography style={{ fontSize: 10 * zoom, fontFamily: 'monospace' }}>{row.label}</Typography>
                                    <Typography style={{ fontSize: 10 * zoom, fontFamily: 'monospace', fontWeight: '500' }}>{row.value}</Typography>
                                </View>
                            ) : null)}
                        </View>

                        {/* Divider */}
                        <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', borderStyle: 'dashed', marginVertical: 8 * zoom }} />

                        {/* Layanan Section */}
                        {(data.services || (data.type === 'bengkel' ? [] : data.items || [])).length > 0 && (
                            <View style={{ marginBottom: 8 * zoom }}>
                                <Typography style={{ fontSize: 11 * zoom, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 * zoom, fontFamily: 'monospace' }}>LAYANAN</Typography>
                                {(data.services || (data.type === 'bengkel' ? [] : data.items || [])).map((item, index) => (
                                    <View key={index} style={{ marginBottom: 6 * zoom }}>
                                        <Typography style={{ fontSize: 11 * zoom, fontWeight: '500', fontFamily: 'monospace', textTransform: 'uppercase' }}>{item.description}</Typography>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Typography style={{ fontSize: 11 * zoom, fontFamily: 'monospace' }}>
                                                {item.quantity} x {formatCurrency(item.unitPrice).replace('Rp', '').trim()}
                                            </Typography>
                                            <Typography style={{ fontSize: 11 * zoom, fontWeight: '600', fontFamily: 'monospace' }}>
                                                {formatCurrency(item.subtotal).replace('Rp', '').trim()}
                                            </Typography>
                                        </View>
                                    </View>
                                ))}
                                <View style={{ borderTopWidth: 1, borderTopColor: '#000', borderStyle: 'dashed', marginVertical: 4 * zoom }} />
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Typography style={{ fontSize: 11 * zoom, fontFamily: 'monospace' }}>Total</Typography>
                                    <Typography style={{ fontSize: 11 * zoom, fontWeight: 'bold', fontFamily: 'monospace' }}>
                                        {formatCurrency((data.services || (data.type === 'bengkel' ? [] : data.items || [])).reduce((acc, c) => acc + c.subtotal, 0)).replace('Rp', '').trim()}
                                    </Typography>
                                </View>
                            </View>
                        )}

                        {/* Spare Part Section */}
                        {(data.parts || []).length > 0 && (
                            <View style={{ marginBottom: 8 * zoom }}>
                                <View style={{ borderTopWidth: 1, borderTopColor: '#000', borderStyle: 'dashed', marginVertical: 8 * zoom }} />
                                <Typography style={{ fontSize: 11 * zoom, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 * zoom, fontFamily: 'monospace' }}>SPARE PART</Typography>
                                {(data.parts || []).map((item, index) => (
                                    <View key={index} style={{ marginBottom: 6 * zoom }}>
                                        <Typography style={{ fontSize: 11 * zoom, fontWeight: '500', fontFamily: 'monospace', textTransform: 'uppercase' }}>{item.description}</Typography>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Typography style={{ fontSize: 11 * zoom, fontFamily: 'monospace' }}>
                                                {item.quantity} x {formatCurrency(item.unitPrice).replace('Rp', '').trim()}
                                            </Typography>
                                            <Typography style={{ fontSize: 11 * zoom, fontWeight: '600', fontFamily: 'monospace' }}>
                                                {formatCurrency(item.subtotal).replace('Rp', '').trim()}
                                            </Typography>
                                        </View>
                                    </View>
                                ))}
                                <View style={{ borderTopWidth: 1, borderTopColor: '#000', borderStyle: 'dashed', marginVertical: 4 * zoom }} />
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Typography style={{ fontSize: 11 * zoom, fontFamily: 'monospace' }}>Total</Typography>
                                    <Typography style={{ fontSize: 11 * zoom, fontWeight: 'bold', fontFamily: 'monospace' }}>
                                        {formatCurrency((data.parts || []).reduce((acc, c) => acc + c.subtotal, 0)).replace('Rp', '').trim()}
                                    </Typography>
                                </View>
                            </View>
                        )}

                        {/* Divider */}
                        <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', borderStyle: 'dashed', marginVertical: 8 * zoom }} />

                        {/* Summary */}
                        <View style={{ marginBottom: 4 * zoom }}>
                            {[
                                { label: 'Status', value: data.status },
                                { label: 'Metode Bayar', value: data.paymentMethod },
                                { label: 'SubTotal', value: formatCurrency(data.subtotal).replace('Rp', '').trim() },
                                { label: 'Diskon', value: formatCurrency(data.discount || 0).replace('Rp', '').trim() },
                            ].map((row, i) => row.value ? (
                                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 * zoom }}>
                                    <Typography style={{ fontSize: 10 * zoom, fontFamily: 'monospace' }}>{row.label}</Typography>
                                    <Typography style={{ fontSize: 10 * zoom, fontFamily: 'monospace', fontWeight: '500' }}>{row.value}</Typography>
                                </View>
                            ) : null)}

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 * zoom, paddingTop: 4 * zoom, borderTopWidth: 1, borderTopColor: '#000' }}>
                                <Typography style={{ fontSize: 12 * zoom, fontWeight: 'bold', fontFamily: 'monospace' }}>Total</Typography>
                                <Typography style={{ fontSize: 12 * zoom, fontWeight: 'bold', fontFamily: 'monospace' }}>{formatCurrency(data.total).replace('Rp', '').trim()}</Typography>
                            </View>
                        </View>

                        {/* Footer */}
                        <View style={{ borderTopWidth: 1, borderTopColor: '#000', borderStyle: 'dashed', marginVertical: 8 * zoom }} />

                        {data.vehiclePlate ? (
                            <View style={{ marginBottom: 8 * zoom }}>
                                <Typography style={{ fontSize: 11 * zoom, fontWeight: '500', fontFamily: 'monospace' }}>{data.vehiclePlate}</Typography>
                                <View style={{ borderTopWidth: 1, borderTopColor: '#000', borderStyle: 'dashed', marginVertical: 4 * zoom }} />
                            </View>
                        ) : null}

                        <View style={{ alignItems: 'center', marginTop: 4 * zoom }}>
                            <Typography style={{ fontSize: 10 * zoom, textAlign: 'center', fontFamily: 'monospace' }}>
                                {settings.footer || 'Terimakasih atas kepercayaan anda'}
                            </Typography>
                        </View>
                    </View>
                </ScrollView>

                {/* Actions */}
                <View className="bg-surface px-6 py-4 border-t border-gray-200" style={{ gap: 12 }}>
                    <Button
                        title="Cetak Struk"
                        onPress={onPrint}
                        loading={loading}
                        icon={<Printer size={20} color="white" />}
                        className="h-14 rounded-2xl"
                    />
                    <Button
                        variant="outline"
                        title="Simpan PDF"
                        onPress={onSavePDF}
                        loading={loading}
                        icon={<Download size={20} color="#023C69" />}
                        className="h-14 rounded-2xl"
                    />
                </View>
            </View>
        </Modal>
    );
};
