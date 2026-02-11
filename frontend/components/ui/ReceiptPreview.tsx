import React, { useState } from 'react';
import { View, ScrollView, Modal, TouchableOpacity, Platform } from 'react-native';
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
                        <TouchableOpacity
                            onPress={() => setZoom(Math.max(0.5, zoom - 0.25))}
                            className="w-10 h-10 bg-gray-100 rounded-xl items-center justify-center"
                        >
                            <ZoomOut size={20} color="#374151" />
                        </TouchableOpacity>
                        <Typography variant="caption" weight="medium" className="text-textGray">
                            {Math.round(zoom * 100)}%
                        </Typography>
                        <TouchableOpacity
                            onPress={() => setZoom(Math.min(2, zoom + 0.25))}
                            className="w-10 h-10 bg-gray-100 rounded-xl items-center justify-center"
                        >
                            <ZoomIn size={20} color="#374151" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={onClose}
                            className="w-10 h-10 bg-gray-100 rounded-xl items-center justify-center ml-2"
                        >
                            <X size={20} color="#374151" />
                        </TouchableOpacity>
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
                            <Typography
                                style={{ fontSize: 16 * zoom, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 * zoom }}
                            >
                                {settings.companyName}
                            </Typography>
                            {settings.header && (
                                <Typography style={{ fontSize: 12 * zoom, fontWeight: '600', textAlign: 'center', marginBottom: 4 * zoom }}>
                                    {settings.header}
                                </Typography>
                            )}
                            <Typography style={{ fontSize: 10 * zoom, textAlign: 'center', color: '#666', marginBottom: 2 * zoom }}>
                                {settings.companyAddress}
                            </Typography>
                            <Typography style={{ fontSize: 10 * zoom, textAlign: 'center', color: '#666' }}>
                                {settings.companyPhone}
                            </Typography>
                        </View>

                        {/* Divider */}
                        <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', borderStyle: 'dashed', marginVertical: 8 * zoom }} />

                        {/* Transaction Info */}
                        <View style={{ marginBottom: 4 * zoom }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 * zoom }}>
                                <Typography style={{ fontSize: 10 * zoom, color: '#333' }}>No. Transaksi</Typography>
                                <Typography style={{ fontSize: 10 * zoom, fontWeight: '500' }}>{data.transactionNumber}</Typography>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 * zoom }}>
                                <Typography style={{ fontSize: 10 * zoom, color: '#333' }}>Tanggal</Typography>
                                <Typography style={{ fontSize: 10 * zoom, fontWeight: '500' }}>{formatDate(data.date)}</Typography>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 * zoom }}>
                                <Typography style={{ fontSize: 10 * zoom, color: '#333' }}>Jam</Typography>
                                <Typography style={{ fontSize: 10 * zoom, fontWeight: '500' }}>{formatTime(data.date)}</Typography>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 * zoom }}>
                                <Typography style={{ fontSize: 10 * zoom, color: '#333' }}>Customer</Typography>
                                <Typography style={{ fontSize: 10 * zoom, fontWeight: '500' }}>{data.customerName}</Typography>
                            </View>

                            {/* Type specific */}
                            {data.type === 'bengkel' && data.vehiclePlate && (
                                <>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 * zoom }}>
                                        <Typography style={{ fontSize: 10 * zoom, color: '#333' }}>No. Polisi</Typography>
                                        <Typography style={{ fontSize: 10 * zoom, fontWeight: '500' }}>{data.vehiclePlate}</Typography>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 * zoom }}>
                                        <Typography style={{ fontSize: 10 * zoom, color: '#333' }}>Kendaraan</Typography>
                                        <Typography style={{ fontSize: 10 * zoom, fontWeight: '500' }}>{data.vehicleType}</Typography>
                                    </View>
                                </>
                            )}
                        </View>

                        {/* Divider */}
                        <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', borderStyle: 'dashed', marginVertical: 8 * zoom }} />

                        {/* Items */}
                        <View style={{ marginBottom: 4 * zoom }}>
                            <Typography style={{ fontSize: 11 * zoom, fontWeight: 'bold', marginBottom: 6 * zoom }}>RINCIAN</Typography>
                            {data.items.map((item, index) => (
                                <View key={index} style={{ marginBottom: 6 * zoom }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <View style={{ flex: 1, marginRight: 8 * zoom }}>
                                            <Typography style={{ fontSize: 10 * zoom, fontWeight: '500' }}>{item.description}</Typography>
                                            {item.quantity && item.unitPrice && (
                                                <Typography style={{ fontSize: 9 * zoom, color: '#666' }}>
                                                    {item.quantity} x {formatCurrency(item.unitPrice)}
                                                </Typography>
                                            )}
                                        </View>
                                        <Typography style={{ fontSize: 10 * zoom, fontWeight: '600' }}>
                                            {formatCurrency(item.subtotal)}
                                        </Typography>
                                    </View>
                                </View>
                            ))}
                        </View>

                        {/* Divider */}
                        <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', borderStyle: 'dashed', marginVertical: 8 * zoom }} />

                        {/* Total */}
                        <View style={{ marginBottom: 4 * zoom }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 * zoom, paddingTop: 4 * zoom, borderTopWidth: 1, borderTopColor: '#000' }}>
                                <Typography style={{ fontSize: 12 * zoom, fontWeight: 'bold' }}>TOTAL</Typography>
                                <Typography style={{ fontSize: 12 * zoom, fontWeight: 'bold' }}>{formatCurrency(data.total)}</Typography>
                            </View>
                            {data.paymentMethod && (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 * zoom }}>
                                    <Typography style={{ fontSize: 10 * zoom, color: '#333' }}>Metode Bayar</Typography>
                                    <Typography style={{ fontSize: 10 * zoom, fontWeight: '500' }}>{data.paymentMethod.toUpperCase()}</Typography>
                                </View>
                            )}
                        </View>

                        {/* Divider */}
                        <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', borderStyle: 'dashed', marginVertical: 8 * zoom }} />

                        {/* Footer */}
                        <View style={{ alignItems: 'center' }}>
                            {settings.footer && (
                                <Typography style={{ fontSize: 10 * zoom, textAlign: 'center', marginBottom: 4 * zoom }}>
                                    {settings.footer}
                                </Typography>
                            )}
                            <Typography style={{ fontSize: 8 * zoom, color: '#999', textAlign: 'center' }}>
                                Struk ini dicetak otomatis
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
                        icon={<Download size={20} color="#00AA13" />}
                        className="h-14 rounded-2xl"
                    />
                </View>
            </View>
        </Modal>
    );
};
